// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue';
import App from './App';
import router from './router';
import Vue2Filters from 'vue2-filters';
import store from './store';
import globalMixin from './mixins/global';
import setupFilters from './utils/filters';
import VueLoadersBallBeat from 'vue-loaders/dist/loaders/ball-beat';
import Toast from 'vue-toastification';
import 'vue-loaders/dist/vue-loaders.css';
import 'vue-toastification/dist/index.css';
import './styles/overrides.scss';
import VTooltip from 'v-tooltip';
import config from './config';
import configAvalanche from './configAvalanche';
import ConfigArbitrum from './configArbitrum';

window.ethereum.request({method: 'eth_chainId'}).then((id) => {
  const chainId = parseInt(id, 16);
  console.log(chainId);

  switch (chainId) {
    case 43114: {
      Object.assign(config, configAvalanche);
      break;
    }
    case 42161: {
      Object.assign(config, ConfigArbitrum);
      break;
    }
  }

  Vue.config.productionTip = false;

  Vue.use(Vue2Filters);
  Vue.use(VueLoadersBallBeat);
  Vue.use(Toast);
  Vue.use(VTooltip, {
    defaultPlacement: 'bottom',
    autoHide: false
  });

  Vue.mixin(globalMixin);

// notifi modal close on outside click
  let handleOutsideClick;
  Vue.directive('closable', {
    bind(el, binding, vnode, prevVnode) {
      handleOutsideClick = (e) => {
        e.stopPropagation();

        const {handler, exclude} = binding.value;
        let clickedOnExcludedEl = false;

        exclude.forEach(refName => {
          if (!clickedOnExcludedEl) {
            const excludedEl = vnode.context.$refs[refName];
            clickedOnExcludedEl = excludedEl && excludedEl.$el.contains(e.target);
          }
        });

        if (!el.contains(e.target) && !clickedOnExcludedEl) {
          vnode.context[handler]();
        }
      };
      document.addEventListener('click', handleOutsideClick);
      // document.addEventListener('touchstart', handleOutsideClick); // for mobile
    },

    unbind() {
      document.removeEventListener('click', handleOutsideClick);
      // document.removeEventListener('touchstart', handleOutsideClick); // for mobile
    }
  });

  setupFilters();

  /* eslint-disable no-new */
  new Vue({
    el: '#app',
    store,
    router,
    template: '<App/>',
    components: {App}
  });
})

