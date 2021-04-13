import './common';
import fs from 'fs-extra';
import {promisify} from 'bluebird';
import prompt from 'prompt';

import ProblemResult from '/model/problemResult';
import Submission from '/model/submission';
import User from '/model/user';

const main = async () => {
  prompt.start();
  const result = await promisify(prompt.get)({
    properties: {
      problem: {
        description: `The problem id`,
        required: true,
      },
      start: {
        description: `start date ex: 2020-10-29T14:20:00+08:00`,
        required: true,
      },
      end: {
        description: `end date ex: 2020-10-29T14:20:00+08:00`,
        required: true,
      }
    }
  });

  let results = await ProblemResult
    .find({ '$and': [
      {'problem': result.problem},
      {ts: {$lt: new Date(result.end)}},
      {ts: {$gt: new Date(result.start)}}
    ] })
    .populate('user', 'roles meta');

  const len = results.length;
  let cnt = 0;
  let output = '';
  for (let result of results) {
    if (result.user.roles.includes('student')) {
      output += `${result.user.meta.name || ''},${result.user.meta.id || ''},${result.points}\n`;
    }
    //console.log(result.user);
    //const hws = await Homework.find()
    //.where('problems.problem').equals(sub.problem)
    //.where('due').gte(sub.ts);

    //for (let hw of hws) {
    //await lazyUpdateHomeworkResult(hw, sub);
    //}
    cnt++;
    if (cnt % 100 == 0) console.log(`Updated ${cnt}/${len}`);
  }

  await fs.writeFile(`result_prob_${result.problem}.csv`, output, (err) => {
    if (err) throw err;

    console.log('done');
  });
};

main();
