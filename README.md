# ADA Judge https://ada-judge.csie.ntu.edu.tw

# Original Project
https://github.com/bobogei81123/adajudge  
https://github.com/tzupengwang/adajudge

# Installation
```
# install nvm
# https://github.com/creationix/nvm

# install node
nvm install v10.10.0

# install mongodb
sudo apt update
sudo apt install mongodb

# install gulp and forever
# npm update; npm audit fix;
npm install -g gulp forever

# Install package. It would take a while. Use default configuration is fine when being prompted.
npm install

# Install needed packages
sudo apt install libseccomp-dev libseccomp2 seccomp libcap-dev asciidoc gcc g++ make python numactl
# Install python2 setuptools for git upload hook (git submission only)

# Init
gulp init
# Semantic auto install is bugged
# So choose extend my settings > automatic manually when prompted

# Build semantic again...
(cd semantic; gulp build)
# Copy (or symbolic link) ./semantic to dist/static/semantic
# cp -r semantic dist/static/
# use RELATIVE PATH instead of realpath:
ln -s ../../semantic/dist dist/static/semantic

# IMPORTANT! MUST DO:
# Create src/server/config.js
# example: config.example.js
# SHOULD check the number of numa pool and edit the config
# maximum number of numaPool: view by `numactl --hardware` command (type: Array<{cpu:${id},mem:${id}}>. The array length MUST NOT greater than the number of numa nodes, the ids of the nodes can also be found from the command output.)
# maxWorkers: the maximum number of total workers
# maxNodeWorkers: unknown

# Build
# be sure that the default checker `src/server/cfiles/default_checker.cpp` can be compiled successfully 
gulp build
cp src/server/scripts/*.sh dist/scripts/; cp src/server/scripts/*.py dist/scripts/;

# Build and copy isolate (and make sure `dist/judger/isolate` exists and has setuid and execute permission (rwsr-sr-x))
gulp isolate # and enter sudo password, sometimes it fails to prompt for password, you may need to run the below commands manually
# sudo rm -f isolate/isolate; sudo rm -f dist/judger/isolate;
# (cd isolate; make isolate)
# cp ./isolate/isolate dist/judger/
# sudo chown root:root dist/judger/isolate
# sudo chmod +s dist/judger/isolate
# sudo chmod a+x dist/judger/isolate

# Unzip fonts.tar.gz in dist/static
tar xvf fonts.tar.gz -C dist/static/

# Link MathJax
ln -s ../../node_modules/mathjax/ dist/static/MathJax

# Edit isolate config
sudo mkdir /usr/local/etc
sudo cp isolate.conf /usr/local/etc/isolate
# Modify isolate sandbox permission
sudo chown -R root:root /dev/shm/isolate
sudo chmod 755 /dev/shm/isolate
sudo chmod 755 /dev/shm/isolate/META

# Build gitosis from https://github.com/res0nat0r/gitosis (git submission only)
sudo adduser --system --shell /bin/sh --gecos 'git version control' --group --disabled-password --home /home/git git
# create ssh key: ssh-keygen
# Initialize gitosis
sudo -H -u git gitosis-init < ~/.ssh/id_rsa.pub
git clone git@localhost:gitosis-admin.git

# Set git config (git submission only)
# git config --global user.email "you@example.com"
# git config --global user.name "Your Name"
# Copy /bin/cp to /home/git/cp with owner 'git' and set its set-user-id bit
sudo cp /bin/cp /home/git/; sudo chown git:git /home/git/cp; sudo chmod +s /home/git/cp;

# Initialize init git repository (git submission only)
sudo cp -r git/init.git /home/git/repositories/
sudo chown -R git:git /home/git/repositories/init.git
sudo chmod 755 /home/git/repositories/init.git/hooks/*
sudo cp git/serve.py /usr/local/lib/python2.7/dist-packages/gitosis-0.2-py2.7.egg/gitosis/
# Install python(2) package 'requests' for all user (git)

# Run server on port 3333
./start.sh

# `forever list` to view process status
# `node dist/scripts/add_admin.js` to add an admin account
# source codes change: `gulp build; forever restartall;`
# semantic change: `(cd semantic; gulp build); forever restartall;`

# install apache2 server or nginx server and redirect connection to port 80 to http://localhost:3333/ and start the server
# install pymongo from pip3
# many judge_name, domain_name, email_address, ... need to be changed
```

# Misc

## override semantic css
file `semantic/src/site/collections/table.overrides`
```
/*******************************
         Site Overrides
*******************************/

.ui.definition.table tr td.definition, .ui.definition.table > tbody > tr > td:first-child:not(.ignored), .ui.definition.table > tfoot > tr > td:first-child:not(.ignored), .ui.definition.table > tr > td:first-child:not(.ignored) {
    background: rgba(0, 0, 0, .03);
    font-weight: 700;
    color: rgba(255, 255, 255, 1);
    text-transform: '';
    -webkit-box-shadow: '';
    box-shadow: '';
    text-align: '';
    font-size: 1em;
    padding-left: '';
    padding-right: ''
}
```

## Title color

DSA: teal
ADA: olive

In file `src/client/js/components/root/menu.pug`, the menu-font color:
DSA: #6dffff
ADA: #b5cc18

If the website did not change after rebuild, delete the node_modules directory and reinstall and rebuild everything again.  
Also, check if website caches are cleared.

# Issue
Kindly submit any issue you found on github.  
TODO: fix addUsersByHand.js or use add_user.js
