import { createApp } from 'vue';
import VxeUITable from 'vxe-table';
import VxeUI from 'vxe-pc-ui';
import App from './App.vue';
import router from './router';
import { pinia } from './stores';
import 'vxe-pc-ui/lib/style.css';
import 'vxe-table/lib/style.css';
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/index.scss';

const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(VxeUI);
app.use(VxeUITable);
app.use(ElementPlus);

app.mount('#app');
