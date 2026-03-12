import { createApp } from 'vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { MotionPlugin } from '@vueuse/motion';
import App from './app/App.vue';
import { router } from './app/router';
import { queryClient } from './shared/api/queryClient';
import '@fontsource-variable/inter/index.css';
import './app/styles/index.css';

const app = createApp(App);

app.use(router);
app.use(VueQueryPlugin, { queryClient });
app.use(MotionPlugin);

app.mount('#app');
