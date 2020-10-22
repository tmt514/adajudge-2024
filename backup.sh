#/bin/bash
#cd "$( dirname "${BASH_SOURCE[0]}" )"
#DIR="$(cd -P "$(dirname "$0")" && pwd)"
cd -P "$(dirname "$0")"
backup_dir=../backup
DATE=`date +%Y%m%d-%H%M%S`
root_dir=$backup_dir/$DATE
submissions_dir=./submissions
homeworks_dir=./homeworks
problems_dir=./problems
mkdir -p $root_dir
mongodump --archive=$root_dir/adajudge.${DATE}.gz --gzip --db adajudge
tar -zcf $root_dir/submissions.tar.gz $submissions_dir
tar -zcf $root_dir/homeworks.tar.gz $homeworks_dir
tar -zcf $root_dir/problems.tar.gz $problems_dir/*/prob.md
#rclone sync /home/ada2018/backup adajudge_backup:  --drive-root-folder-id aabbcc
