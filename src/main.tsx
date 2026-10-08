import { render } from 'preact';
import { reloadOnUpdate } from './platform/update';
import { App } from './ui/App';
import './styles.css';

reloadOnUpdate();
render(<App />, document.getElementById('app')!);
