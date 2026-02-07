import { Routes } from '@angular/router';

//import { LoginPage } from './components/login/login.page';

import { SecondBrainWidgetComponent } from './components/secondbrain/widget/secondbrain.widget.component'; 
import { SecondBrainSetupComponent } from './components/secondbrain/setup/secondbrain.setup.component'; 
import { SecondBrainConnectComponent } from './components/secondbrain/connect/secondbrain.connectcomponent'; 
import { SecondBrainOauthSuccessComponent } from './components/secondbrain/oauth-success/secondbrain.oauth-success.component'; 

export const routes: Routes = [
	// {
	// 	path: 'login',
	// 	component: LoginPage,
	// },
	{
		path: 'secondbrain/widget',
		component: SecondBrainWidgetComponent,
	},
	{
		path: 'secondbrain/widget/:clientId',
		component: SecondBrainWidgetComponent,
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
		redirectTo: 'secondbrain/widget',
		pathMatch: 'full',
	},
	{
		path: '**',
		redirectTo: '/', // 잘못된 URL 처리
	}
];