import { Routes } from '@angular/router';

//import { LoginPage } from './components/login/login.page';

import { SecondBrainWidgetComponent } from './components/secondbrain/widget/secondbrain.widget.component';
import { SecondBrainSetupComponent } from './components/secondbrain/setup/secondbrain.setup.component';
import { SecondBrainConnectComponent } from './components/secondbrain/connect/secondbrain.connect.component';
import { SecondBrainOauthSuccessComponent } from './components/secondbrain/oauth-success/secondbrain.oauth-success.component';
import { SecondBrainOauthFailComponent } from './components/secondbrain/oauth-fail/secondbrain.oauth-fail.component';

import { ServiceManagerComponent } from './components/pages/serviceManager/service-manager.component';

import { RoutineComponent } from './components/pages/routine/routine.component';
import { RoutineFindComponent } from './components/pages/routine/pages/rountine-find/routine-find.component';
import { MyRoutineComponent } from './components/pages/routine/pages/my-rountine/my-routine.component';
import { RoutineCreateComponent } from './components/pages/routine/pages/rountine-create/rountine-create.component';

import { AutoManagerComponent } from './components/pages/autoManager/auto-manager.component';

import { MyPageComponent } from './components/pages/myPage/myPage.component';
import { ProfileComponent } from './components/pages/myPage/pages/profile/profile.component';
import { SecurityComponent } from './components/pages/myPage/pages/security/security.component';
import { SubscriptionComponent } from './components/pages/myPage/pages/subscription/subscription.component';
import { NotificationComponent } from './components/pages/myPage/pages/notification/notification.component';

import { WorkspaceLayoutComponent } from './workspace-layout.component';
import { WidgetLayoutComponent } from './widget-layout.component';

import { WorkspaceHomeComponent } from './components/pages/workspace-home/workspace-home.component';
import { UpdateComponent } from './components/pages/life-up/pages/update/update.component';

import { UnauthorizedComponent } from './components/login/app-unauthorized.component';

import { authGuard } from './services/auth.guard';
import { AgentConnectComponentComponent } from './components/pages/myPage/agent-connect-component/agent-connect-component.component';

export const routes: Routes = [
	// 루트 진입 시
	{
		path: '',
		redirectTo: 'workspace/home',
		pathMatch: 'full'
	},
	{
		path: 'workspace',
		component: WorkspaceLayoutComponent,
		canActivate: [ authGuard ],
		children: [
			{
				path: 'home',
				component: WorkspaceHomeComponent
			},
			{
				path: 'service',
				component: ServiceManagerComponent
			},
			{
				path: 'routine',
				component: RoutineComponent,
				children: [
					{
						path: '',
						redirectTo: 'find',
						pathMatch: 'full'
					},
					{
						path: 'find',
						component: RoutineFindComponent
					},
					{
						path: 'myroutine',
						component: MyRoutineComponent
					},
					{
						path: 'create',
						component: RoutineCreateComponent
					}
				]
			},			
			{
				path: 'auto',
				component: AutoManagerComponent
			},
			{
				path: 'auto',
				component: UpdateComponent
			},
			{
				path: 'mypage',
				component: MyPageComponent,
				children: [
					{
						path: '',
						redirectTo: 'profile',
						pathMatch: 'full'
					},
					{
						path: 'profile',
						component: ProfileComponent
					},
					{
						path: 'subscription',
						component: SubscriptionComponent
					},
					{
						path: 'notification',
						component: NotificationComponent
					},
					{
						path: 'security',
						component: SecurityComponent
					}, 
					{
						path: 'agent-connect',
						component: AgentConnectComponentComponent
					}
				]
			},
			// secondbrain api
			{
				path: 'secondbrain',
				redirectTo: 'secondbrain/widget',
				pathMatch: 'full'
			},
			{
				path: 'secondbrain/widget',
				component: SecondBrainWidgetComponent
			},
			{
				path: 'secondbrain/widget/:userId',
				component: SecondBrainWidgetComponent
			},
			{
				path: 'secondbrain/setup',
				component: SecondBrainSetupComponent
			},
			{
				path: 'secondbrain/connect',
				component: SecondBrainConnectComponent
			},
			{
				path: 'secondbrain/oauth-success',
				component: SecondBrainOauthSuccessComponent
			},
			{
				path: 'secondbrain/oauth-fail',
				component: SecondBrainOauthFailComponent
			}
		]
	},

	{
		path: '',
		component: WidgetLayoutComponent,
		children: [
			{
			path: 'secondbrain/widget',
			component: SecondBrainWidgetComponent
			},
			{
			path: 'secondbrain/widget/:userId',
			component: SecondBrainWidgetComponent
			},
			{
			path: 'secondbrain/setup',
			component: SecondBrainSetupComponent
			},
			{
			path: 'secondbrain/connect',
			component: SecondBrainConnectComponent
			},
			{
			path: 'secondbrain/oauth-success',
			component: SecondBrainOauthSuccessComponent
			},
			{
			path: 'secondbrain/oauth-fail',
			component: SecondBrainOauthFailComponent
			}
		]
	},
	{
		path: 'unauthorized',
		component: UnauthorizedComponent
	},
	{
		path: '**',
		redirectTo: 'workspace/home', // 잘못된 URL 처리
	}

];
