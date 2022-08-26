import fs from 'fs-extra';
import { ArgumentParser as Parser } from 'argparse';
import './common';
import config from '/config';
import Homework from '/model/homework';
import Submission from '/model/submission';

const parser = new Parser({
  description: 'Copy submissions of problem id y in homework id x (exclude admin & TA) before deadline to /home/ada/adajudge2022/moss/x_y/'
});

parser.addArgument(['problem_id'], { type: 'int', help: 'id of the problem' });
parser.addArgument(['homework_id'], { type: 'int', help: 'id of the homework' });

(async () => {
  const args = parser.parseArgs();

  const homework = await Homework.findOne({$and: [{_id: args.homework_id},{"problems.problem": { $in : [args.problem_id]}}]}, 'due');
  if (!homework) {
    console.log('no such homework_id problem_id pair');
    return;
  }

  const submissions = await Submission.aggregate([{
    '$lookup': {
      'from': 'users', 
      'localField': 'submittedBy', 
      'foreignField': '_id', 
      'as': 'roles'
    }
  }, {
    '$project': {
      'ts': 1, 
      'problem': 1, 
      'result': 1, 
      'roles': { '$arrayElemAt': [ '$roles.roles', 0] },
      'id': { '$arrayElemAt': ['$roles.meta.id', 0] }
    }
  }, {
    '$match': {
      '$and': [
        { 'result': 'AC' }, 
        { 'problem': args.problem_id }, 
        { 'ts': { '$lt': homework.due } }, 
        { 'roles': { '$nin': [ 'admin', 'TA' ] } }
      ]
    }
  }, {
    '$project': { '_id': 1, 'id': 1 }
  }]);

  const folder = `/home/ada/adajudge2022/moss/${args.homework_id}_${args.problem_id}`;
  fs.mkdirSync(folder, { recursive: true }, (err) => { if (err) throw err; });
  for (let i = 0; i < submissions.length; i++) {
    fs.copyFileSync(`${config.dirs.submissions}/${submissions[i]._id}.cpp`, `${folder}/${submissions[i].id}_${submissions[i]._id}.cpp`, (err) => { if (err) throw err; });
  }
  
  console.log('done');

  return;
})();
