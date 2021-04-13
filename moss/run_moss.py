#!/usr/bin/python3
import os
import sys
import mosspy

userid = 123456789 # fill your id here
m = mosspy.Moss(userid, "cc")

if len(sys.argv) < 2:
    print('usage:\tcpp_folder report_folder')
    exit(0)
fd = sys.argv[1]
name = sys.argv[2]
cpp = {}

for f in os.listdir(fd):
    if '_' in f:
        a, b = f.split('_')
        if a not in cpp:
            cpp[a] = []
        cpp[a].append(b)
    else:
        if f not in cpp:
            cpp[f] = []
        cpp[f].append(f)

cnt = 0
for k, v in cpp.items():
    if 'cpp' not in v[0]:
        continue
    try:
        _v = sorted(v, key=lambda x: int(x.split('.')[0]))
        v = _v
    except:
        pass
    print(k, v)
    cnt += 1
    if k == v[0]:
        m.addFile(f'{fd}/{k}')
    else:
        m.addFile(f'{fd}/{k}_{v[0]}')
print(cnt)

url = m.send(lambda file_path, display_name: print('*', end='', flush=True))
print()
print(url)
print ("Report Url: " + url)

os.makedirs(name, exist_ok=True)
m.saveWebPage(url, f"{name}/report.html")
mosspy.download_report(url, f"{name}/", connections=8, log_level=10,on_read=lambda url: print('*', end='', flush=True))
