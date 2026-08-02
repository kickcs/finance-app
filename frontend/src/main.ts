import { createApp } from 'vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { MotionPlugin } from '@vueuse/motion';
import App from './app/App.vue';
import { handleStaleChunks } from './app/plugins/handleStaleChunks';
import { router } from './app/router';
import { watchPlatformSwitch } from './shared/lib/platform/platformPage';
import { queryClient } from './shared/api/queryClient';
import { i18n } from './shared/i18n';
import './app/styles/fonts.css';
import './app/styles/index.css';

handleStaleChunks();

// Живёт здесь, а не в router/index.ts: подписка перезагружает страницу, и в
// тестах, которые подменяют платформу, это ронял бы прогон.
watchPlatformSwitch(router);

const app = createApp(App);

app.use(router);
app.use(VueQueryPlugin, { queryClient });
app.use(MotionPlugin);
app.use(i18n);

app.mount('#app');
