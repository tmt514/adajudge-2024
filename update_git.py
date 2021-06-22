import os
import time
import sys
import pymongo
client=pymongo.MongoClient('mongodb://localhost:27017/')
db=client['dsajudge']
users=db['users']
while True:
    pubs=os.listdir("gitosis-admin/keydir")
    f=open("gitosis-admin/gitosis.conf","w")
    f.write("[gitosis]\n\n")
    f.write("[group gitosis-admin]\n")
    f.write("members = "+os.getlogin()+"@"+os.uname()[1]+"\n")
    f.write("writable = gitosis-admin init akihabara\n\n")
    for pub in pubs:
        if(pub.endswith(".pub")):
            name=pub[:-4]
        else:
            continue
        f.write("[group "+name+"]\n")
        f.write("members = "+name+"\n")
        f.write("writable = "+name+"\n")
        f.write("readonly = akihabara\n\n")
    for group in users.find({'accountType': 'Group'}):
        gid=group['meta']['id']
        members=[gid]+group['groups']
        f.write('[group '+gid+']\n')
        f.write('members = '+' '.join(members)+'\n')
        f.write('writable = '+' '.join(members)+'\n')
        f.write('readonly = akihabara\n\n')
    f.flush()
    f.close()
    os.system("git -C gitosis-admin add . >/dev/null")
    os.system("git -C gitosis-admin commit -m update >/dev/null")
    os.system("git -C gitosis-admin push >/dev/null >/dev/null")
    time.sleep(15)

"""
[gitosis]

[group gitosis-admin]
members = mvnl@mvnl-Saab
writable = gitosis-admin

[group b05902086]
members = b05902086
writable = b05902086

"""
