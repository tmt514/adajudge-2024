import pymongo

client=pymongo.MongoClient('mongodb://localhost:27017/')
db=client['dsajudge']
users=db['users']
hws=db['homeworks']
submits=db['submissions']

students=users.find({'roles':'student'})
idt={}
for student in students:
    idt[student['_id']]=student['meta']['id']

homeworkid=input('homeworkid: ')
hw=hws.find_one({'_id':int(homeworkid)})
probs=hw['problems']
due=hw['due']
weights={}
pids=[]
for prob in probs:
    weight=prob['weight']
    pid=prob['problem']
    weights[pid]=weight
    pids.append(pid)

scores={}
subs=submits.find({'$and':[{'points':{'$gt':0}},{'problem':{'$in':pids}},{'submittedBy':{'$in':list(idt.keys())}}]})
for sub in subs:
    pid=sub['problem']
    point=sub['points']
    uid=idt[sub['submittedBy']]
    ts=sub['ts']
    if uid not in scores:
        scores[uid]={}
        for p in pids:
            scores[uid][p]=0
    if ts>due: 
        delta=ts-due
        point*=max(0.,1-delta.total_seconds()/(86400*5))
    scores[uid][pid]=max(scores[uid][pid],point)

out=input('output file: ')
with open(out,'w') as f:
    for sid,res in scores.items():
        total=0
        pts=[]
        for pid,point in res.items():
            pts.append(point*weights[pid])
            total+=point*weights[pid]
        print(sid,total,*pts,sep=',',file=f)
