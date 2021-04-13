import './common';
import User from '/model/user';
import bcrypt from 'bcrypt';
import prompt from 'prompt';
import randomString from 'randomstring';
import {promisify} from 'bluebird';

import {ArgumentParser as Parser} from 'argparse';
import XLSX from 'xlsx';

const parser = new Parser({
  description: 'Bulk update users info',
  addHelp: true
});

parser.addArgument(
  [ 'file' ],
  {
    help: 'The xlsx file'
  }
);

const main = async () => {
  const args = parser.parseArgs();

  const wb = XLSX.readFile(args.file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_csv(sheet).split('\n').slice(1);

  // Choose the correct columns according to input xls file
  // const ID=3, NAME = 4, EMAIL = 5;
  const ID = 3, NAME = 1, EMAIL = 0, ROLE = 2;
  for (let r of rows) {
    if (!r || !r.length) break;
    const td = r.split(',');
    const user = {
      email: td[EMAIL],
      id: td[ID] || '',
      name: td[NAME],
      roles: [td[ROLE]]
    };
    console.log(td[EMAIL], td[ID], td[NAME], td[ROLE]);
    await updateUser(td[EMAIL], td[ID], td[NAME], td[ROLE]);
  }

  console.log('Ended...');
};

const updateUser = async (email, id, name, role) => {
  const randPass = randomString.generate(10);
  const hashed = await promisify(bcrypt.hash)(randPass, 10);

  // const roles = ['student'];
  let user = await User.findOne({email: email});
  if (!user) {
    throw 'user not exist';
  } else {
    user.roles = [role];
  }
  console.log(user);
  await user.save();
};

if (require.main === module) {
  main();
}
