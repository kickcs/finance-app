import { createApp } from 'vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import App from './app/App.vue';
import { router } from './app/router';
import { queryClient } from './shared/api/queryClient';
import './app/styles/index.css';

const app = createApp(App);

app.use(router);
app.use(VueQueryPlugin, { queryClient });

app.mount('#app');
