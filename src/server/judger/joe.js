import config from '/config';
import {execFile} from 'child_process';
import path from 'path';
import _ from 'lodash';
import fs from 'fs-extra';
import YAML from 'yamljs';
import {diffWords} from 'diff';
import temp from 'temp';
import {promisify} from 'bluebird';
import {InvalidOperationError} from 'common-errors';
import logger from '/logger';

const ISOLATE = path.join(__dirname, 'isolate');

function isolateWrap (opt,boxId) {
  return new Promise((resolve, reject) => {
    if(config.numa&&config.numaPool&&config.numaPool.length&&boxId!==undefined){
      const poolId = (boxId*config.numaPool.length/config.maxWorkers) | 0;
      const numaObj = config.numaPool[poolId];
      const cpu = numaObj.cpu;
      const mem = numaObj.mem;
      execFile(
        'numactl',
        ["--cpubind="+cpu.toString(),"--membind="+mem.toString(),ISOLATE,...opt],
        {},
        (err, stdout, stderr) => {
			console.log(err);
			console.log(stdout);
			console.log(stderr);
          // if (err) return reject(err); // here
          resolve(
            _.assignIn({
              stdout,
              stderr
            })
          );
        }
      );
    }else{
      execFile(
        ISOLATE,
        opt,
        {},
        (err, stdout, stderr) => {
			console.log(err);
			console.log(stdout);
			console.log(stderr);
          // if (err) return reject(err); // here
          resolve(
            _.assignIn({
              stdout,
              stderr
            })
          );
        }
      );
    }
  });
}

function isolateWrapNoReturn (opt, boxId) {
  return new Promise((resolve, reject) => {
    if(config.numa&&config.numaPool&&config.numaPool.length&&boxId!==undefined){
      const poolId = (boxId*config.numaPool.length/config.maxWorkers) | 0;
      const numaObj = config.numaPool[poolId];
      const cpu = numaObj.cpu;
      const mem = numaObj.mem;
      execFile(
        'numactl',
        ["--cpubind="+cpu.toString(),"--membind="+mem.toString(),ISOLATE,...opt],
        {},
        (err, stdout, stderr) => {
          if (err) return reject(err);
          resolve();
        }
      );
    }else{
      execFile(
        ISOLATE,
        opt,
        {},
        (err, stdout, stderr) => {
          if (err) return reject(err);
          resolve();
        }
      );
    }
  });
}

function flat_opt (opt) {
  return _.flatten(_.map(opt, (val, key) => val === true ? ['--' + key] : ['--' + key, val]));
}

async function init (id) {
  const opt = {
    cg: true,
    'box-id': id,
    init: true
  };
  const _opt = [...flat_opt(opt)];
  await isolateWrapNoReturn(_opt);
}
async function cleanup (id) {
  const opt = {
    cg: true,
    'box-id': id,
    cleanup: true
  };
  const _opt = [...flat_opt(opt)];
  await isolateWrapNoReturn(_opt);
}
export async function reset (id) {
  await cleanup(id);
  await init(id);
}

const metaDir = path.join(config.dirs.isolate, 'META');

export async function compile (worker_id, cppFiles, execName, GPP, GPPLink) {
  const opt = {
    cg: true,
    'box-id': worker_id,
    meta: path.join(metaDir, worker_id.toString()),
    mem: 1 << 20,
    'cg-mem': 1 << 20,
    time: 20,
    'wall-time': 30,
    fsize: 1 << 20,
    'full-env': true,
    process: true,
    silent: true,
    stdout: 'compile.out',
    stderr: 'compile.err',
    run: true
  };

  const _opt = [
    ...flat_opt(opt),
    '--',
    ...[...GPP, '-o', execName, ...cppFiles, ...GPPLink]
  ];

  let result = await isolateWrap(_opt, worker_id);
  let fl = await fs.readFile(path.join(metaDir, worker_id.toString()));
  result = _.assignIn(result, YAML.parse('---\n' + fl.toString().replace(/:/g, ': ') + '...\n'));
  if (result.status == 'RE') { result.RE = true; }
  if (result.status == 'SG') {
    if (result.message.endsWith(' 31')) { result.SE = true; } else { result.RE = true; }
  }
  if (result.status == 'TO') { result.TLE = true; }
  if (result.status == 'XX') { result.RE = true; }
  return result;
}

export async function run (worker_id, exec, inFile, outFile, errFile, timeLimit, memLimit = (1 << 20), args = []) {
  // const timeLimitCeil = Math.ceil(timeLimit);
  const timeLimitCeil = timeLimit;
  if (!memLimit) {
    memLimit = 1 << 20;
  }
  const opt = {
    // z: 1,
    cg: true,
    'box-id': worker_id,
    meta: path.join(metaDir, worker_id.toString()),
    mem: memLimit,
    time: timeLimitCeil,
    'wall-time': timeLimitCeil * 2,
    fsize: 1 << 20,
    silent: true,
    stdout: 'run.out',
    stderr: 'run.err',
    run: true
  };
  if (inFile) opt.stdin = inFile;
  if (outFile) opt.stdout = outFile;
  if (errFile) opt.stderr = errFile;

  const _opt = [
    ...flat_opt(opt),
    '--',
    `./${exec}`,
    ...args
  ];

  let result = await isolateWrap(_opt, worker_id);
  let fl = await fs.readFile(path.join(metaDir, worker_id.toString()));
  if (outFile) {
    let out = await fs.readFile(path.join(config.dirs.isolate, worker_id.toString(), 'box', outFile));
    result.out = out;
  }
  if (errFile) {
    let err = await fs.readFile(path.join(config.dirs.isolate, worker_id.toString(), 'box', errFile));
    result.err = err;
  }
  result = _.assignIn(result, YAML.parse('---\n' + fl.toString().replace(/:/g, ': ') + '...\n'));
  if (result.status == 'RE') { 
    if (result.exitcode == 2) { result.PE = true; }
    else if (result.exitcode == 3) { result.FAIL = true; }
    else { result.RE = true; }
  }
  if (result.status == 'SG') {
    if (result.message.endsWith(' 31')) { result.SE = true; } else { result.RE = true; }
  }
  if (result.status == 'TO') { result.TLE = true; }
  if (result.status == 'XX') { result.RE = true; }
  if (!result.RE && !result.TLE && result.time >= timeLimit + 0.001) {
    result.TLE = true;
  }

  return result;
}
