import express from 'express';
import HomeworkResult from '/model/homeworkResult';
import wrap from 'express-async-wrap';
import {requireLogin, checkProblem, checkHomework} from '/utils';
import * as probStat from '/statistic/problem';
import * as hwStat from '/statistic/homework';
import _ from 'lodash';

const router = express.Router();

router.get('/problem/:id', requireLogin, checkProblem(), wrap(async (req, res) => {
    if(isNaN(req.problem._id))return res.status(400).send(`id must be a number`);
    if( (!req.user || !( req.user.isAdmin()||req.user.isTA()) ) && !req.problem.showScoreboard)return res.status(403).send(`you should not see this`);
    const result = await Promise.all([
        probStat.getProblemHighest(req.problem._id),
    ]);
    const stats = _.zipObject(['highest'], result);
    const problem = req.problem;
    if( !problem.resource ){
        problem.resource = [];
    }
    if( (req.user.isAdmin()||req.user.isTA()) && !problem.resource.includes('solution') ){
        problem.resource.push('solution');
    }
    res.send({
        stats,
        problem,
    });
}));

router.get('/homework/:id', requireLogin, checkHomework(), wrap(async (req, res) => {
    if(isNaN(req.homework._id))return res.status(400).send(`id must be a number`);
    if( (!req.user || !(req.user.isAdmin()||req.user.isTA()) ) && !req.homework.showScoreboard)return res.status(403).send(`you should not see this`);
    const result = await Promise.all([
        hwStat.getHomeworkHighest(req.homework._id)
    ]);
    const stats = _.zipObject(['highest'], result);
    const hw = req.homework;
    res.send({
        stats,
        hw,
    });
}));

export default router;
