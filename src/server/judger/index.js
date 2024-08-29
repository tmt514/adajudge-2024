import path from 'path';
import Submission from '/model/submission';
import Result from '/model/result';
import Homework from '/model/homework';
import ProblemResult from '/model/problemResult';
import HomeworkResult from '/model/homeworkResult';
import sleep from 'sleep-promise';
import _ from 'lodash';
import logger from '/logger';
import Judge from './judge';
import config from '/config';
import Worker from './pool';
import {lazyUpdateHomeworkResult, updateProblemResult} from '/statistic';

async function updateStatistic (sub) {
  const problem = sub.problem;
  const res = await updateProblemResult(sub);

  const hws = await Homework.find()
    .where('problems.problem').equals(problem)
    .where('due').gte(sub.ts);

  for (let hw of hws) {
    await lazyUpdateHomeworkResult(hw, sub);
  }
}
async function prepareJudge (sub) {
  sub.status = 'judging';
  sub.result = null;
  sub.judgeTs = Date.now();
  if (sub.result) {
    const _result = await Result.findById(sub._result);
    if (_result) {
      await _result.purge();
    }
  }
  await sub.save();
}

let count = 0;
async function startJudge (sub, workers) {
  let result;
  try {
    logger.info(`judging #${sub._id}`);
    const judge = new Judge(sub);
    result = await judge.go(workers);
  } catch (e) {
    // eslint-disable-next-line require-atomic-updates
    sub.status = 'error';
    // eslint-disable-next-line require-atomic-updates
    sub.result = 'JE';
    // eslint-disable-next-line require-atomic-updates
    sub.points = 0;
    logger.error(`#${sub._id} judge error`, e);
    await sub.save();
    count -= 1;
    return;
  }
  // eslint-disable-next-line require-atomic-updates
  sub.status = 'finished';
  ['result', 'points', 'runtime'].forEach(x => {
    sub[x] = result[x];
  });
  logger.info(`judge #${sub._id} finished, result = ${result.result}`);
  await sub.save();
  try {
    await updateStatistic(sub);
  } catch (e) {
    console.log(e);
  }
  count -= 1;
}

async function mainLoop () {
  const workers = [];
  for (let i = 0; i < config.maxWorkers; i++) {
    workers.push(new Worker(i));
  }
  while (true) {
    let pending = await (
      Submission.findOne({status: 'pending'})
        .sort("_id")
        .populate('problem')
    );
    if (!pending) {
      pending = await (
        Submission.findOne({status: 'pending-rejudge'})
          .sort("_id")
          .populate('problem')
      );
    }
    if (!pending) {
      await sleep(1000);
      continue;
    }
    if (count >= 1/*workers.length*/) {
      await sleep(100);
      continue;
    }
    count += 1;
    await prepareJudge(pending);
    startJudge(pending, workers);
    await sleep(50);
  }
}

export default mainLoop;
