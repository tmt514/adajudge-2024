echo Input NTU mail account used to send mail to new users
read -p 'student id: ' mail_id
read -p 'password: ' -s mail_passwd
echo ''
while [[ 1 ]]
do
    echo Input the information of the new user
    read -p 'student id: ' user_id
    read -p 'name: ' user_name
    read -p 'email (leave blank for default NTU mail): ' user_mail
    if [[ -z $user_mail ]]
    then
	user_mail="${user_id}@ntu.edu.tw"
    fi
    read -p 'role ("TA" or "admin" or "student"): ' user_role
    echo -e "${mail_id}\n${mail_passwd}\n${user_id}\n${user_name}\n${user_mail}\n${user_role}\n" | timeout 5 node addUsersByHand.js 2> /dev/null # | sed -e '/{/{:1; /}/!{N; b1}; /{/p}; d'
    if [[ ${PIPESTATUS[1]} -ne 0 ]]
    then
	echo Failed to add new user
    else
	echo Succeeded
    fi
    read -p 'Continue to add next user? (y/n): ' con
    [[ ! $con =~ [yY] ]] && break
done

