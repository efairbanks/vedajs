import Layout from '../components/layout';
import body from './index.md';
import shader from './index.frag';

const attach = veda => {
  veda.loadFragmentShader(shader);
};

const detach = () => {};

const article = { body, attach, detach };

export default () => (
  <Layout article={article}/>
);
