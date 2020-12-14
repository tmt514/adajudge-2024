import Vue from 'vue';
import html from './homework.pug';
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
                result = (await this.$http.get(`/scoreboard/homework/${this.id}`)).data;
            } catch(e) {
                console.log(e);
            }
            _.assignIn(this, result);
        },
    },
});
