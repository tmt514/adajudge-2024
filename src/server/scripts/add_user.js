import './common';
import User from '/model/user';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import randomString from 'randomstring';
import prompt from 'prompt';
import {promisify} from 'bluebird';
import {ArgumentParser as Parser} from 'argparse';

const parser = new Parser({
  description: 'Add a new user, and send password mail',
  addHelp: true
});

parser.addArgument(['email'], { help: 'account email' });
parser.addArgument(['id'], { help: 'account id' });
parser.addArgument(['name'], { help: 'account (chinese) name' });
parser.addArgument(['type'], { help: 'account type, User or Group'});
parser.addArgument(['role'], { nargs:'+', help: 'account role' });

(async () => {
  const args = parser.parseArgs();

  prompt.start();
  const result = await promisify(prompt.get)({
    properties: {
      account: {
        description: `Your NTU account, don't input @ntu.edu.tw\n (The mail would be send by your account)`,
        pattern: /^\w+$/,
        message: 'Input a valid NTU account',
        required: true
      },
      password: {
        hidden: true
      },
      sendMail: {
        message: 'Do you want to send a mail to user about new account? Y/N',
        required: true
      }
    }
  });

  const randPass = randomString.generate(10);
  const hashed = await promisify(bcrypt.hash)(randPass, 10);
  const accountType = args.type;
  const roles = args.role;
  const user = new User({
    email: args.email,
    password: hashed,
    roles: roles,
    accountType: accountType,
    meta: {
      id: args.id,
      name: args.name
    }
  });

  if (result.sendMail === 'Y') {
    const smtpConfig = {
      host: 'smtps.ntu.edu.tw',
      port: 465,
      secure: true,
      auth: {
        user: result.account,
        pass: result.password
      }
    };


    const mailTransporter = nodemailer.createTransport(smtpConfig);

    const text = (
      `Welcome to ADA2020, this email is to inform you that your ADA Judge account has been created.
  Here is your account and temporary password. (You can change your password after logging in.)

  - Account: ${args.email}
  - Password: ${randPass}

  Head on to https://ada-judge.csie.ntu.edu.tw/ and try it!
  `);

    const mailOptions = {
      from: '"ada2020" <ada-ta@csie.ntu.edu.tw >',
      to: args.email,
      subject: '[ADA2020]Your ADA Judge Account',
      text
    };
    console.log(user);
    await user.save();
    await new Promise((resolve, reject) => {
      mailTransporter.sendMail(mailOptions, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
    console.log(`mail send to ${args.email}`);
  } else {
    console.log(user);
    await user.save();
  }

  console.log(`User ${args.email} ${randPass} successfully added`);
})();
