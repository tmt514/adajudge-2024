import csv
import sys
import subprocess
import pymongo

if len(sys.argv)!=2:
    print('require 1 arguments: teams csv')
    exit(0)

teams=sys.argv[1]
lst,tot,cnt=[],[],0

client=pymongo.MongoClient('mongodb://localhost:27017/')
db=client['dsajudge']
users=db['users']
groups=users.find({"meta.id": { "$regex": "team.*"}, "roles": "student","accountType":"Group"})
for group in groups:
    for user in group['groups']:
        tot.append(user)
    cnt+=1

with open(teams,'r',newline='',encoding='utf-8') as csvf:
    rows=csv.reader(csvf)
    for row in rows:
        mem=[None]*3
        name,mem[0],mem[1],mem[2]=row[1],row[5],row[9],row[13]
        mem=list(set(mem))
        if '' in mem:
            mem.remove('')
        if '無' in mem:
            mem.remove('無')
        if 'None' in mem:
            mem.remove('None')
        if len(name)>16:
            print('Team',name,mem,'failed since the team name is too long')
            continue
        mem=[stuid.lower() for stuid in mem]
        fail=0
        for sid in mem:
            if sid in tot:
                fail=1
        if fail:
            print('Team',name,mem,'failed since someone is existing before')
            continue
        email='team'+str(cnt+1)+'@csie.ntu.edu.tw'
        tid='team'+str(cnt+1)
        subprocess.run(['node','add_group.js',email,tid,name,'student']+mem,timeout=10) 
        tot+=mem
        cnt+=1

