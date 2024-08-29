import express from 'express';
import Submission from '/model/submission';
import wrap from 'express-async-wrap';
import _ from 'lodash';
import config from '/config';
import path from 'path';
import User from '/model/user';
import { requireLogin, requireKey } from '/utils';
import fs from 'fs-extra';
import Problem from '/model/problem';
import Result from '/model/result';
import { execFile } from 'child_process';

const router = express.Router();

router.get('/', requireLogin, wrap(async (req, res) => {
  const skip = parseInt(req.query.start) || 0;
  const isTA = req.user && (req.user.isAdmin() || req.user.isTA());
  var ids=req.user.groups;
  if(!ids) ids=[];
  ids=await Promise.all(ids.map(id => User.findOne({ "meta.id": id })));
  ids=ids.filter(user => user!=null).map(user => user._id);
  ids.push(req.user._id);
  const data = await Submission.aggregate([
    { $match: { submittedBy: { $in: ids }} },
    {
      $lookup: {
        from: Problem.collection.name,
        as: 'problem',
        let: { problem: '$problem' },
        pipeline: [
          {
            $match: {
              ...(isTA ? {} : { visible: true }),
              $expr: {
                $eq: ['$$problem', '$_id']
              }
            }
          }, {
            $limit: 1
          }
        ]
      }
    },
    { $unwind: '$problem' },
    { $sort: { _id: -1 } },
    { $skip: skip * 15 },
    { $limit: 15 },
    {
      $project: {
        _id: 1,
        'problem._id': 1,
        'problem.name': 1,
        ts: 1,
        result: 1,
        runtime: 1,
        status: 1,
        points: 1
      }
    }
  ]);
  res.send(data);
  // console.log(skip);
}));

const MAX_COMPILE_LOG_LEN = 10000;
async function loadCompileErr (id) {
  try {
    const buf = await fs.readFile(path.join(config.dirs.submissions, `${id}.compile.err`));
    const str = buf.toString();
    // console.log(str.length);
    if (str.length > MAX_COMPILE_LOG_LEN) return str.slice(0, MAX_COMPILE_LOG_LEN) + '\n... [The remained was omitted]\n';
    return str;
  } catch (e) {
    return 'Compiler log unavailable.';
  }
}

async function loadSourceCode (id) {
  try {
    const buf = await fs.readFile(path.join(config.dirs.submissions, `${id}.cpp`));
    const str = buf.toString();
    return str;
  } catch (e) {
    return 'Source code unavailable.';
  }
}

function loadFormatSourceCode (id) {
  return new Promise((resolve, reject) => {
    execFile('clang-format', [path.join(config.dirs.submissions, `${id}.cpp`)], {},
      (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve(stdout);
      }
    );
  });
}

router.get('/sourceCode/:id', requireLogin, wrap(async (req, res) => {
  if (isNaN(req.params.id)) return res.status(400).send('id must be a number');
  const id = req.params.id;
  const submission = await Submission.findById(id)
    .populate('problem', 'resource visible notGitOnly')
    ;

  if (!submission) return res.status(404).send(`Submission ${id} not found.`);
  var ids=req.user.groups;
  if(!ids) ids=[];
  ids=await Promise.all(ids.map(id => User.findOne({ "meta.id": id })));
  ids=ids.filter(user => user!=null).map(user => user._id);
  ids.push(req.user._id);
  if (!(req.user && (req.user.isAdmin() || req.user.isTA())) &&
        !((ids.find(id => submission.submittedBy.equals(id)) && submission.problem.visible && submission.problem.notGitOnly) || submission.problem.resource.includes('solution'))) {
    return res.status(403).send('Permission denided.');
  }
  if (req.query.format) {
    try {
      res.send(await loadFormatSourceCode(id));
    } catch (e) {
      res.send(await loadSourceCode(id));
      console.log('clang-format failed.');
    }
  } else {
    res.send(await loadSourceCode(id));
  }
}));

router.get('/:id', requireLogin, wrap(async (req, res) => {
  if (isNaN(req.params.id)) return res.status(400).send('id must be a number');
  const isTA = req.user && (req.user.isAdmin() || req.user.isTA());

  const id = req.params.id;
  let submission;
  submission = await Submission.findById(id)
    .populate('problem', 'name testdata.points resource visible notGitOnly showDetailSubtask')
    .populate('submittedBy', (req.user.isAdmin() ? 'email meta' : 'meta'))
    .populate({
      path: '_result',
      populate: {
        path: 'subresults',
        select: '-_id -__v',
        populate: {
          path: 'subresults',
          select: '-_id -__v -subresults -maxPoints -points'
        }
      }
    });
  if (!submission) return res.status(404).send(`Submission ${id} not found.`);
  var ids=req.user.groups;
  if(!ids) ids=[];
  ids=await Promise.all(ids.map(id => User.findOne({ "meta.id": id })));
  ids=ids.filter(user => user!=null).map(user => user._id);
  ids.push(req.user._id);
  if (!(req.user.isAdmin() || req.user.isTA()) &&
        !((ids.find(id => submission.submittedBy.equals(id)) && submission.problem.visible) || submission.problem.resource.includes('solution'))) {
    return res.status(403).send('Permission denided.');
  }

  submission = submission.toObject();
  if (submission.status === 'pending') {
    submission.queuePosition = await Submission.count(
      { status: 'pending', _id: { $lt: submission._id } }
    ) + 1
  }
  if (submission.status === 'pending-rejudge') {
    submission.queuePosition = await Submission.count({
      $or: [
        { status: 'pending' },
        { status: 'pending-rejudge', _id: { $lt: submission._id } }
      ]
    }) + 1
  }
  if (submission.result === 'CE') {
    submission.compilationLog = await loadCompileErr(submission._id);
  }
  if (submission._result && !req.user.isAdmin()) {
    for (const [gid, group] of submission._result.subresults.entries()) {
      for (const [tid, test] of group.subresults.entries()) {
        test.name = `${gid}-${tid}`;
      }
    }
  }
  if (!submission.problem.showDetailSubtask && !isTA) {
    if (submission._result && submission._result.subresults) {
      for (const subresult of submission._result.subresults) {
        subresult.subresults = [];
      }
    }
  }

  res.send(submission);
}));

router.post('/get/last', requireKey, wrap(async (req, res) => {
  const isTA = req.user && (req.user.isAdmin() || req.user.isTA());
  var ids=req.user.groups;
  if(1) ids=[];
  //ids=await Promise.all(ids.map(id => User.findOne({ "meta.id": id })));
  //ids=ids.map(user => user._id);
  ids.push(req.user._id);
  let data = await Submission.aggregate([
    { $match: { submittedBy: { $in: ids }} },
    {
      $lookup: {
        from: Problem.collection.name,
        as: 'problem',
        let: { problem: '$problem' },
        pipeline: [
          {
            $match: {
              ...(isTA ? {} : { visible: true }),
              $expr: {
                $eq: ['$$problem', '$_id']
              }
            }
          }, {
            $limit: 1
          }
        ]
      }
    },
    { $unwind: '$problem' },
    { $sort: { _id: -1 } },
    { $limit: 1 }
  ]);

  if (data.length === 0) {
    res.send({});
  } else {
    data = await Result.populate(data[0], {
      path: '_result',
      populate: {
        path: 'subresults',
        select: '-_id -__v',
        populate: {
          path: 'subresults',
          select: '-_id -__v -subresults -maxPoints -points'
        }
      }
    });
    if (!isTA && !data.problem.visible) {
      return res.status(403).send('Permission denided.');
    } else {
      if (!data.problem.showDetailSubtask && !isTA) {
        if (data._result && data._result.subresults) {
          for (const subresult of data._result.subresults) {
            subresult.subresults = [];
          }
        }
      }
      res.send(data);
    }
  }
}));

router.post('/get/gitHash', requireKey, wrap(async (req, res) => {
  const user = req.user;
  const isTA = user && (user.isAdmin() || user.isTA());
  const smallerHash = req.body.gitHash.toLowerCase();
  const biggerHash = smallerHash.substr(0, smallerHash.length - 1) + String.fromCharCode(smallerHash.charCodeAt(smallerHash.length - 1) + 1);
  var ids=req.user.groups;
  if(!ids) ids=[];
  ids=await Promise.all(ids.map(id => User.findOne({ "meta.id": id })));
  ids=ids.filter(user => user!=null).map(user => user._id);
  ids.push(req.user._id);
  let data = await Submission.aggregate([
    {
      $match: {
        submittedBy: { $in: ids },
        gitCommitHash: {
          $gte: smallerHash,
          $lt: biggerHash
        }
      }
    },
    {
      $lookup: {
        from: Problem.collection.name,
        as: 'problem',
        let: { problem: '$problem' },
        pipeline: [
          {
            $match: {
              ...(isTA ? {} : { visible: true }),
              $expr: {
                $eq: ['$$problem', '$_id']
              }
            }
          }, {
            $limit: 1
          }
        ]
      }
    },
    { $unwind: '$problem' },
    { $sort: { _id: -1 } },
    { $limit: 1 }
  ]);
  if (data.length === 0) {
    res.send('Submission Not Found!');
  } else {
    data = await Result.populate(data[0], {
      path: '_result',
      populate: {
        path: 'subresults',
        select: '-_id -__v',
        populate: {
          path: 'subresults',
          select: '-_id -__v -subresults -maxPoints -points'
        }
      }
    });
    if (!isTA && !data.problem.visible) {
      return res.status(403).send('Permission denided.');
    } else {
      if (!data.problem.showDetailSubtask && !isTA) {
        if (data._result && data._result.subresults) {
          for (const subresult of data._result.subresults) {
            subresult.subresults = [];
          }
        }
      }
      res.send([data]);
    }
  }
}));

export default router;
