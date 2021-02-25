# ADA Judge
https://ada-judge.csie.ntu.edu.tw

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
sudo apt install mongodb

# install gulp and forever
npm install -g gulp forever

# Install package, it would take a while
npm install

# Init
gulp init
# Semantic auto install is bugged
# So choose extend my settings > automatic manually when prompted

# Build semantic again...
(cd semantic; gulp build)

# Change src/server/config.js
# example: config.example.js

# Build
gulp build

# Install seccomp
sudo apt install libseccomp-dev libseccomp2 seccomp libcap-dev asciidoc

# Build and copy isolate
sudo -H gulp isolate

# Unzip fonts.tar.gz in dist/static
tar xvf fonts.tar.gz -C dist/static/

# Link MathJax
ln -s ../../node_modules/mathjax/ dist/static/MathJax

# Edit isolate config
sudo mkdir /usr/local/etc
sudo cp isolate.conf /usr/local/etc/isolate

# Run server
./start.sh

```

# Misc

## override semantic css
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

# Issue
Kindly submit any issue you found on github.
