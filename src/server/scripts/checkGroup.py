import pymongo

client=pymongo.MongoClient('mongodb://localhost:27017/')
db=client['dsajudge']
users=db['users']
groups=users.find({"meta.id": { "$regex": "team.*"}, "roles": "student","accountType":"Group"})
students=users.find({"roles":"student","accountType":"User"})

grptbl={}
usertbl={}

for group in groups:
    grptbl[group["meta"]["id"]]=group["groups"]

for student in students:
    usertbl[student["meta"]["id"]]=student["groups"] if "groups" in student else []

for (grp,mems) in grptbl.items():
    for mem in mems:
        if mem not in usertbl:
            print(f'The member {mem} in team {grp} does not exist.')
        elif len(usertbl[mem])<1 or usertbl[mem][0]!=grp:
            print(f'The group of {mem} is not team {grp}.')

for (user,grps) in usertbl.items():
    if len(grps)>=1:
        grp=grps[0]
        if grp not in grptbl:
            print(f'The team {grp} of {user} does not exist.')
        elif user not in grptbl[grp]:
            print(f'The group {grp} does not contain a member {user}.')

