#/bin/sh
mkdir /dev/shm/isolate
mkdir /dev/shm/isolate/META
mkdir /tmp/judge-comp
sudo bash ./start_root.sh
(cd dist; NODE_ENV=production forever start server.js)
