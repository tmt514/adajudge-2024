"use strict";

require("./common");

var _user = _interopRequireDefault(require("/home/ada2018/adajudge2021/dist/model/user"));

var _nodemailer = _interopRequireDefault(require("nodemailer"));

var _bcrypt = _interopRequireDefault(require("bcrypt"));

var _prompt = _interopRequireDefault(require("prompt"));

var _randomstring = _interopRequireDefault(require("randomstring"));

var _bluebird = require("bluebird");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const main = async () => {
  _prompt.default.start();

  const result = await (0, _bluebird.promisify)(_prompt.default.get)({
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
      email: {
        description: 'The email of the account to be reset: ',
        required: true
      }
    }
  });
  const smtpConfig = {
    host: 'smtps.ntu.edu.tw',
    port: 465,
    secure: true,
    auth: {
      user: result.account,
      pass: result.password
    }
  };

  const mailTransporter = _nodemailer.default.createTransport(smtpConfig);

  await resetUser(result.email, mailTransporter);
  console.log('Ended...');
};

const resetUser = async (email, transporter) => {
  const randPass = _randomstring.default.generate(10);

  const hashed = await (0, _bluebird.promisify)(_bcrypt.default.hash)(randPass, 10);
  console.log(randPass);
  console.log(hashed);
  const user = await _user.default.findOne({
    email
  });
  user.password = hashed;
  await user.save();
  const text = `Welcome to ADA2021, this email is to inform you that your ADA Judge account has been created.
Here is your account and temporary password. (You can change your password after logging in.)

- Account: ${email}
- Password: ${randPass}

Head on to https://ada-judge.csie.ntu.edu.tw/ and try it!
`;
  const mailOptions = {
    from: '"ada2021" <ada-ta@csie.ntu.edu.tw>',
    to: email,
    subject: '[ADA2021] Your ADA Judge Account',
    text
  };
  await new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  }); // await user.save();

  console.log(`${email} successfully sended.`);
};

if (require.main === module) {
  main();
}
//# sourceMappingURL=resetPasswd.js.map
