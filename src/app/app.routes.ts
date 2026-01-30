import { Routes } from '@angular/router';

//import { LoginPage } from './components/login/login.page';

import { SecondBrainViewComponent } from './components/secondbrain/view/secondbrain.view.component'; 
import { SecondBrainSetupComponent } from './components/secondbrain/setup/secondbrain.setup.component'; 
import { SecondBrainConnectComponent } from './components/secondbrain/connect/secondbrain.connectcomponent'; 
import { SecondBrainOauthSuccessComponent } from './components/secondbrain/oauth-success/secondbrain.oauth-success.component'; 


export const routes: Routes = [
	// {
	// 	path: 'login',
	// 	component: LoginPage,
	// },
	{
		path: 'secondbrain/view',
		component: SecondBrainViewComponent,
	},
	{
		path: 'secondbrain/setup',
		component: SecondBrainSetupComponent,
	},
	{
		path: 'secondbrain/connect',
		component: SecondBrainConnectComponent,
	},
	{
		path: 'secondbrain/oauth-success',
		component: SecondBrainOauthSuccessComponent,
	},
	{
		path: '',
		redirectTo: 'secondbrain/view',
		pathMatch: 'full',
	},
	{
		path: '**',
		redirectTo: '/', // 잘못된 URL 처리
	}
];