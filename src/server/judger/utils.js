import _ from 'lodash';

const resultComp = {
    CE: 1000000,
    SE: 100000,
    RE: 10000,
    PE: 1000,
    WA: 100,
    TLE: 10,
    AC: 0,
};

export function mergeResult(_arr) {
    if (!_arr || !_arr.length) return;
    let arr = _.uniq(_arr);
    arr = _.sortBy(arr, x => _.get(resultComp, x, 1e10));
    return arr[0];
}
