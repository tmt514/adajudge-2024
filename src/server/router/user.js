import config from '/config';
import express from 'express';
import { requireLogin } from '/utils';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs-extra';
import wrap from 'express-async-wrap';
import { promisify } from 'bluebird';
import { execFile } from 'child_process';
import _ from 'lodash';
import randomString from 'randomstring';
import User from '/model/user';
const router = express.Router();

router.get('/me', (req, res) => {
  if (req.user) {
    const user = {};
    user.meta = req.user.meta;
    user.submission_limit = req.user.submission_limit;
    user.roles = req.user.roles;
    user.email = req.user.email;
    user.homeworks = req.user.homeworks;
    user.accountType = req.user.accountType;
    res.send({
      login: true,
      user: user
    });
  } else {
    res.send({
      login: false
    });
  }
});

router.post('/changePassword', requireLogin, wrap(async (req, res) => {
  const comp = await promisify(bcrypt.compareAsync)(req.body['current-password'], req.user.password);
  if (!comp) { return res.status(403).send('Old password is not correct'); }
  const newPassword = req.body['new-password'];
  let changePassword = false;
  if (newPassword.length > 0) {
    if (newPassword !== req.body['confirm-password']) { return res.status(400).send('Two password are not equal.'); }
    if (newPassword.length <= 8) { return res.status(400).send('New password too short'); }
    if (newPassword.length > 30) { return res.status(400).send('New password too long'); }
    try {
      const hash = await promisify(bcrypt.hash)(newPassword, 10);
      // eslint-disable-next-line require-atomic-updates
      req.user.password = hash;
      await req.user.save();
      changePassword = true;
    } catch (e) {
      return res.status(500).send('Something bad happened... New password may not be saved.');
    }
  }
  if (changePassword) {
    res.send('Password changed successfully.');
  } else {
    res.send('Nothing changed.');
  }
}));

export default router;
