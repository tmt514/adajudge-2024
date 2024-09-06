import fs from 'fs-extra';
import config from '/config';
import { errors, TimeoutError, InvalidOperationError } from 'common-errors';
import { compile, run, reset } from './joe';
import Result from '/model/result';
import logger from '/logger';
import path from 'path';
import _ from 'lodash';
import Worker from './pool';
import sleep from 'sleep-promise';
import { execFile } from 'child_process';

const DEFAULT_CHECKER = path.join(config.dirs.cfiles, 'default_checker.cpp');
const TESTLIB = path.join(config.dirs.cfiles, 'testlib.h');
const CTMP = path.join('/tmp', 'judge-comp');

const SCORE_FACTOR = 100;
const AC_SCORE = 100;

const resultMap = {
  CE: 1000000,
  RE: 100000,
  PE: 10000,
  WA: 1000,
  TLE: 100,
  AC: 1
};
const resultReducer = (pointReducer = (p1, p2) => Math.min(p1 || 0, p2 || 0)) => (res, x) => {
  const resW = _.get(resultMap, res.result, 1e9);
    const xW = _.get(resultMap, x.result, 1e9);
  const res_ = {};
  res_.result = resW > xW ? res.result : x.result;
  res_.runtime = Math.max(res.runtime, x.runtime);
  res_.points = pointReducer(res.points, x.points);
  return res_;
};

async function saveResult (obj, result, points = 0) {
  obj.result = result;
  obj.points = points;
  return await obj.save();
}
 
function numaCp (cpu,mem,src,dst) {
  return new Promise((resolve, reject) => {
    execFile('numactl',["--cpubind="+cpu.toString(),"--membind="+mem.toString(),'cp',src,dst], {},
      (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve(_.assignIn({ stdout, stderr }));
      }
    );
  });
}

async function copyToDir (file, dir, newName, boxId) {
  //try {
    await fs.stat(file);
  //} catch (e) {
  //  throw e;//errors.io.FileNotFoundError(file);
  //}

  const newDir = path.join(dir, newName || path.basename(file));
  if(config.numa&&config.numaPool&&config.numaPool.length&&boxId!==undefined){
    const poolId = (boxId*config.numaPool.length/config.maxWorkers) | 0;
    const numaObj = config.numaPool[poolId];
    await numaCp(numaObj.cpu,numaObj.mem,file,newDir);
  } else {
    await fs.copy(file, newDir);
  }
  return newDir;
}

async function mkdir777 (dir) {
  await fs.mkdir(dir);
  await fs.chmod(dir, 0o777);
}

const GCC = [
  '/usr/bin/env',
  'gcc',
  '-static',
  '-O2',
  '-std=c11',
  '-DONLINE_JUDGE'
];
const GCCLink = [
  '-lm'
];
const GPP = [
  '/usr/bin/env',
  'g++',
  '-std=c++17',
  '-march=native',
  '-static',
  '-O2',
  '-DONLINE_JUDGE'
];
const GPPLink = [
];

const isolateDir = config.dirs.isolate;

let work_count = 0;
export default class Judger {
  constructor (sub) {
    this.sub = sub;
    this.problem = sub.problem;
    this.problemDir = path.join(config.dirs.problems, `${sub.problem._id}`);
    this.testdata = this.problem.testdata;
    this.groups = this.testdata.groups;
    this.userCpp = path.join(config.dirs.submissions, `${this.sub._id}.cpp`);
    this.checkerCpp = this.problem.hasSpecialJudge
      ? path.join(this.problemDir, 'checker.cpp') : DEFAULT_CHECKER;
    this.result = new Result({
      name: this.problem._id,
      maxPoints: this.testdata.points
    });
  }

  async prepare () {
    this.sub._result = this.result._id;
    await this.sub.save();
  }

  generateUserCompileTask () {
    return async (compileBoxId) => {
		logger.info(`compileBoxId = ${compileBoxId}`);
      await reset(compileBoxId);
      this.rootDir = path.join(isolateDir, compileBoxId.toString(), 'box');
      await copyToDir(this.userCpp, this.rootDir, 'user.cpp', compileBoxId);
      const exFile = this.problem.compileEXFile || [];
      for (const file of exFile) {
        await copyToDir(path.join(this.problemDir, file), this.rootDir, file, compileBoxId);
      }
      const exHeader = this.problem.compileEXHeader || [];
      for (const file of exHeader) {
        await copyToDir(path.join(this.problemDir, file), this.rootDir, file, compileBoxId);
      }
      // const linkArg = [].concat(GPPLink, this.problem.compileEXLink || []);
      // const gccArg = [].concat(GPP, this.problem.compileEXArg || []);
      // const files = [].concat('user.cpp', exFile);
      const linkArg = [].concat(GPPLink, this.problem.compileEXLink || []);
      const gccArg = [].concat(GPP, this.problem.compileEXArg || []);
      const files = [].concat('user.cpp', exFile);
      const result = await compile(compileBoxId, files, 'user', gccArg, linkArg);
      if (result.RE || result.SE || result.TLE) {
        saveResult(this.result, 'CE');
        await copyToDir(
          path.join(this.rootDir, 'compile.err'),
          config.dirs.submissions,
          `${this.sub._id}.compile.err`
        );
        return false;
      }
      await copyToDir(path.join(this.rootDir, 'user'), CTMP, this.sub._id.toString());
      this.userExec = path.join(CTMP, this.sub._id.toString());
      return true;
    };
  }

  generateCheckerCompileTask () {
    return async (compileBoxId) => {
      await reset(compileBoxId);

      this.rootDir = path.join(isolateDir, compileBoxId.toString(), 'box');
      await copyToDir(this.checkerCpp, this.rootDir, 'checker.cpp', compileBoxId);
      await copyToDir(TESTLIB, this.rootDir, undefined, compileBoxId);
      const exFile = this.problem.compileEXFileForChecker || [];
      for (const file of exFile) {
        await copyToDir(path.join(this.problemDir, file), this.rootDir, file, compileBoxId);
      }
      const exHeader = this.problem.compileEXHeaderForChecker || [];
      for (const file of exHeader) {
        await copyToDir(path.join(this.problemDir, file), this.rootDir, file, compileBoxId);
      }
      const linkArg = [].concat(GPPLink, this.problem.compileEXLinkForChecker || []);
      const gccArg = [].concat(GPP, this.problem.compileEXArgForChecker || []);
      const files = [].concat('checker.cpp', exFile);
      const result = await compile(compileBoxId, files, 'checker', gccArg, linkArg);
      if (result.RE || result.SE || result.TLE) {
        throw Error('Judge Error: Checker Compiled Error.');
      }
      await copyToDir(path.join(this.rootDir, 'checker'), CTMP, this.sub._id.toString() + '_checker');
      this.checkerExec = path.join(CTMP, this.sub._id.toString() + '_checker');
      return true;
    };
  }

  async compileTask (workers, task, error_msg) {
    let error = null;
    while (true) {
      try {
        const worker_result = await Promise.race(workers.map(x => x.finish()));
        if (!worker_result.worker.isIdle) continue;
        await worker_result.worker.run(task, (err) => {
          if (err) {
            logger.error(error_msg, err);
            error = err;
          }
        });
      } catch (e) {
        if (e instanceof InvalidOperationError) {
          continue;
        } else {
          throw e;
        }
      }
      break;
    }
    if (error) { throw Error('Judge error when running.'); }
  }

  async compileUser (workers) {
    if(this.problem.uploadOutput) {
        logger.info('Output only');
        return true;
    }
    await this.compileTask(workers, this.generateUserCompileTask(), 'Judge error @ compileUser');
    return Boolean(this.userExec);
  }

  async compileChecker (workers) {
    await this.compileTask(workers, this.generateCheckerCompileTask(), 'Judge error @ compileChecker');
  }

  async prepareFiles () {

  }

  generateTask (gid, groupResult, tid, testResult) {
    return async (worker_id) => {
      await (async () => {
		logger.info(`reset worker id = ${worker_id}`);
        await reset(worker_id);
        const test = this.groups[gid].tests[tid];
        const tdBase = path.join(this.problemDir, 'testdata', test);
        const [inp, outp] = ['in', 'out'].map(x => `${tdBase}.${x}`);
        const userTDir = path.join(isolateDir, worker_id.toString(), 'box');
        await copyToDir(inp, userTDir, 'prob.in', worker_id);
        if(this.problem.uploadOutput) {
            await copyToDir(this.userCpp, userTDir, 'prob.out', worker_id);
            testResult.runtime = 0;
        }
        else {
            await copyToDir(this.userExec, userTDir, 'user', worker_id);
        }
        const exFile = this.problem.runtimeEXFile || [];
        for (const file of exFile) {
          await copyToDir(path.join(this.problemDir, file), userTDir, file, worker_id);
        }

        const userRes = await run(worker_id, 'user',
          'prob.in', 'prob.out', 'prob.err',
          this.problem.timeLimit, this.problem.memLimit);

        testResult.runtime = userRes.time;
        if (userRes.SE) {
          await saveResult(testResult, 'SE');
          return;
        }
        // if (userRes.RE || userRes.PE || userRes.FAIL) {
        if (userRes.RE) {
          await saveResult(testResult, 'RE');
          return;
        }
        if (userRes.TLE) {
          testResult.runtime = this.problem.timeLimit;
          await saveResult(testResult, 'TLE');
          return;
        }

        await copyToDir(outp, userTDir, 'prob.ans', worker_id);
        await copyToDir(this.checkerExec, userTDir, 'checker', worker_id);

        const files = [
          'prob.in',
          'prob.out',
          'prob.ans'
        ];
        const checkerRes = await run(worker_id, 'checker',
          null, 'checker.out', 'checker.err',
          20, 1 << 23, files);

        if (checkerRes.TLE) {
          throw new Error('Judge Error: Checker TLE.');
        }
        if (checkerRes.FAIL) {
          throw new Error('Checker failed with exit code 3(_fail)');
        }
        if (checkerRes.PE) {
          await saveResult(testResult, 'WA');
        } else if(checkerRes.RE || checkerRes.SE) {
        // if (checkerRes.RE || checkerRes.SE) {
          await saveResult(testResult, 'WA');
        } else {
          if (this.problem.hasPartialScorePerTestdata) {
            await saveResult(testResult, 'AC', parseFloat(checkerRes.out));
          } else {
            await saveResult(testResult, 'AC', SCORE_FACTOR);
          }
        }
      })();
      this.remains[gid]--;
      if (!this.remains[gid]) {
        const _groupResult = _.reduce(
          this.testResults[gid],
          this.problem.hasPartialScorePerTestdata?resultReducer((x,y)=>x+y):resultReducer(),
          { result: 'AC', runtime: 0, points: this.problem.hasPartialScorePerTestdata?0:SCORE_FACTOR }
        );
        _.assignIn(groupResult, _groupResult);
        if(!this.problem.hasPartialScorePerTestdata) {
          groupResult.points = groupResult.points * groupResult.maxPoints / SCORE_FACTOR;
        }
        await groupResult.save();
      }
    };
  }

  generateTaskChain (gid, groupResult, originalTask) {
    return async (worker_id) => {
      await originalTask(worker_id);
      this.remains[gid]--;
      if (!this.remains[gid]) {
        const _groupResult = _.reduce(
          this.testResults[gid],
          this.problem.hasPartialScorePerTestdata?resultReducer((x,y)=>x+y):resultReducer(),
          { result: 'AC', runtime: 0, points: this.problem.hasPartialScorePerTestdata?0:SCORE_FACTOR }
        );
        _.assignIn(groupResult, _groupResult);
        if(!this.problem.hasPartialScorePerTestdata) {
          groupResult.points = groupResult.points * groupResult.maxPoints / SCORE_FACTOR;
        }
        await groupResult.save();
      }
    };
  }

  async loadTasks () {
    this.remains = [];
    this.testResults = [];
    this.groupResults = [];
    const testSet = {};
    const testTaskSet = {};
    for (const [gid, group] of this.groups.entries()) {
      const groupResult = new Result({
        name: `${this.problem._id}.${gid}`,
        maxPoints: group.points
      });

      const tests = [];
      for (const [tid, test] of group.tests.entries()) {
        if (test in testSet) {
          groupResult.subresults.push(testSet[test]._id);
          tests.push(testSet[test]);
          testTaskSet[test] = this.generateTaskChain(
            gid, groupResult, testTaskSet[test]
          );
        } else {
          const testResult = new Result({
            name: `${this.problem._id}_${test}`,
            maxPoints: SCORE_FACTOR
          });
          await testResult.save();
          groupResult.subresults.push(testResult._id);
          testSet[test] = testResult;
          tests.push(testResult);
          testTaskSet[test] = this.generateTask(
            gid, groupResult, tid, testResult
          );
        }
      }

      await groupResult.save();
      this.result.subresults.push(groupResult._id);
      this.testResults.push(tests);
      this.groupResults.push(groupResult);
      this.remains.push(group.tests.length);
    }

    this.tasks = Object.values(testTaskSet);
    await this.result.save();
  }

  async runAndCheck (workers) {
    while (work_count >= workers.length) { await sleep(100); }
    let error = null;
    const run_workers = [];
    for (const [taskID, task] of this.tasks.entries()) {
      work_count += 1;
      run_workers.push((async () => {
        while (true) {
          try {
            const worker_result = await Promise.race(workers.map(x => x.finish()));
            if (!worker_result.worker.isIdle) continue;
            const fat=false;
            if(fat){
              let resLock=null;
              
              const stallWorker=worker_result.worker.run((wid)=>new Promise((resolve)=>{resLock=resolve;}), (err) => {
                if (err) {
                  logger.error(`Judge error @ ${taskID}`, err);
                  error = err;
                }
              });
              while (true) {
                const worker_result = await Promise.race(workers.map(x => x.finish()));
                if (!worker_result.worker.isIdle) continue;
                await worker_result.worker.run(task, (err) => {
                  if (err) {
                    logger.error(`Judge error @ ${taskID}`, err);
                    error = err;
                  }
                });
                break;
              }
              resLock();
              await stallWorker;


            }else{
              await worker_result.worker.run(task, (err) => {
                if (err) {
                  logger.error(`Judge error @ ${taskID}`, err);
                  error = err;
                }
              });
            }
          } catch (e) {
            if (e instanceof InvalidOperationError) {
              continue;
            } else {
              work_count -= 1;
              throw e;
            }
          }
          work_count -= 1;
          break;
        }
      })());
    }
    await Promise.all(run_workers);
    if (error) {
      throw Error('Judge error when running.');
    }

    const reducedResult = _.reduce(
      this.groupResults,
      resultReducer((x, y) => x + y),
      { result: 'AC', runtime: 0, points: 0 }
    );
    _.assignIn(this.result, reducedResult);
    if (this.result.points >= AC_SCORE) {
      this.result.result = 'AC';
    }
    await this.result.save();
  }

  async cleanUp () {
    if (this.userExec) await fs.remove(this.userExec);
    if (this.checkerExec) await fs.remove(this.checkerExec);
  }

  async go (workers) {
    try {
      logger.info('Preparing...');
      await this.prepare();

      logger.info('Compiling User Cpp...');
      const compileFlag = await this.compileUser(workers);
      if (!compileFlag) {
        return this.result;
      }

      logger.info('Compiling Checker Cpp...');
      await this.compileChecker(workers);

      logger.info('Preparing Files...');
      await this.prepareFiles();

      logger.info('Loading Tasks...');
      await this.loadTasks();

      logger.info('Finally, Run and Check...');
      await this.runAndCheck(workers);

      return this.result;
    } finally {
      await this.cleanUp();
    }
  }
}
