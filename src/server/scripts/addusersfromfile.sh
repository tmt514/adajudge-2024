[[ $# -ne 1 ]] || [[ ! -r $1 ]] && echo 'Require a readable file as the argument.' && exit 1
file="$1"
IFS=$'\n' data=($(cat "$file"))
echo Input NTU mail account used to send mail to new users
read -p 'student id: ' mail_id
read -p 'password: ' -s mail_passwd
echo ''
# read -p 'role ("TA" or "admin" otherwise leave blank): ' user_role
# user_role=$(echo "$user_role" | tr -d [[:space:]])
for line in ${data[@]}
do
    [[ -z $line ]] && continue
    user_group=$(echo "$line" | cut -d ',' -f 1 | tr -d '[[:space:]]　')
    user_name=$(echo "$line" | cut -d ',' -f 3 | tr -d '[[:space:]]　')
    user_id=$(echo "$line" | cut -d ',' -f 2 | tr -d '[[:space:]]　')
    user_mail=$(echo "$line" | cut -d ',' -f 4 | tr -d '[[:space:]]　')
    if [[ $user_group =~ 旁聽生 ]]; then user_role=auditor;
    else user_role=student; fi
    echo "$user_group $user_name $user_id $user_mail $user_role"
    # continue
    echo -e "${mail_id}\n${mail_passwd}\n${user_id}\n${user_name}\n${user_mail}\n${user_role}\n" | timeout 5 node addUsersByHand.js 2> /dev/null # | sed -e '/{/{:1; /}/!{N; b1}; /{/p}; d'
    if [[ ${PIPESTATUS[1]} -ne 0 ]]
    then
	echo Failed to add new user
    else
	echo Succeeded
    fi
    continue
    read -p 'Continue to add next user? (y/n): ' con
    [[ ! $con =~ [yY] ]] && break
done

