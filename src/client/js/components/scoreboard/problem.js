import Vue from 'vue';
import html from './problem.pug';
import toastr from 'toastr';
import _ from 'lodash';
import probUtils from 'js/mixins/probUtils';

export default Vue.extend({
    mixins: [probUtils],
    data() {
        return { 
            id: null,
            homeworks: [ ],
            problem: null,
            stats: {},
        };
    },
    template: html,
    ready() {
        this.id = this.$route.params.id;
        this.fetchStatistic();
    },
    methods: {
        async fetchStatistic() {
            let result;
            try {
                result = (await this.$http.get(`/scoreboard/problem/${this.id}`)).data;
            } catch(e) {
                console.log(e);
            }
            _.assignIn(this, result);
            if (this.problem) {
                this.problem.solutionVisible = this.problem.resource 
                    && this.problem.resource.includes('solution');
            }
        },
    },
});
