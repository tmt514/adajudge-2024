import './common';
import User from '/model/user';
import bcrypt from 'bcrypt';
import randomString from 'randomstring';
import {promisify} from 'bluebird';
(async () => {
  const randPass = randomString.generate(10);
  const hashed = await promisify(bcrypt.hash)(randPass, 10);
  console.log("this is password:", randPass);
  const roles = ['admin'];
  const user = new User({
    email: 'admin@ada-judge.csie.ntu.edu.tw',
    password: hashed,
    roles: roles,
    meta: {
      id: 'admin',
      name: 'Admin'
    }
  });
  await user.save();
})();
