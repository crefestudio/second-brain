import { Routes } from '@angular/router';

//import { LoginPage } from './components/login/login.page';

import { NotionConnectComponent } from './components/pages/notion-auth/connect/notion-connect.component';
import { NotionOauthSuccessComponent } from './components/pages/notion-auth/oauth-success/notion-oauth-success.component';
import { NotionOauthFailComponent } from './components/pages/notion-auth/oauth-fail/notion-oauth-fail.component';


import { SecondBrainWidgetComponent } from './components/pages/workspace/pages/secondbrain/widget/secondbrain.widget.component';
import { SecondBrainSetupComponent } from './components/pages/workspace/pages/secondbrain/setup/secondbrain.setup.component';

// import { SecondBrainConnectComponent } from './components/pages/workspace/pages/secondbrain/connect/secondbrain.connect.component';
// import { SecondBrainOauthSuccessComponent } from './components/pages/workspace/pages/secondbrain/oauth-success/secondbrain.oauth-success.component';
// import { SecondBrainOauthFailComponent } from './components/pages/workspace/pages/secondbrain/oauth-fail/secondbrain.oauth-fail.component';

import { ServiceManagerComponent } from './components/pages/workspace/pages/serviceManager/service-manager.component';

import { RoutineComponent } from './components/pages/workspace/pages/routine/routine.component';
import { RoutineFindComponent } from './components/pages/workspace/pages/routine/pages/rountine-find/routine-find.component';
import { MyRoutineComponent } from './components/pages/workspace/pages/routine/pages/my-rountine/my-routine.component';
import { RoutineCreateComponent } from './components/pages/workspace/pages/routine/pages/rountine-create/rountine-create.component';
import { AutoManagerComponent } from './components/pages/workspace/pages/autoManager/auto-manager.component';

import { MyPageComponent } from './components/pages/myPage/myPage.component';
import { ProfileComponent } from './components/pages/myPage/pages/profile/profile.component';
import { SecurityComponent } from './components/pages/myPage/pages/security/security.component';
import { SubscriptionComponent } from './components/pages/myPage/pages/subscription/subscription.component';
import { NotificationComponent } from './components/pages/myPage/pages/notification/notification.component';

import { WorkspaceLayoutComponent } from './workspace-layout.component';
import { WidgetLayoutComponent } from './widget-layout.component';

import { WorkspaceComponent } from './components/pages/workspace/workspace.component';
//import { WorkspaceHomeComponent } from './components/pages/workspace-home/workspace-home.component';
//import { UpdateComponent } from './components/pages/life-up/pages/update/update.component';

import { UnauthorizedComponent } from './components/login/app-unauthorized.component';

import { authGuard } from './services/auth.guard';
import { AgentConnectComponentComponent } from './components/pages/myPage/agent-connect-component/agent-connect-component.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'workspace/home',
    pathMatch: 'full'
  },

  // =========================
  // WORKSPACE
  // =========================
  {
    path: 'workspace',
    component: WorkspaceLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'secondbrain',
        component: SecondBrainWidgetComponent
      },
      {
        path: 'secondbrain/:userId',
        component: SecondBrainWidgetComponent
      },
      {
        path: 'home',
        component: WorkspaceComponent
      },
      {
        path: 'connect',
        component: AgentConnectComponentComponent
      },
      // {
      //   path: 'service',
      //   component: ServiceManagerComponent
      // },
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
      //   {
      //     path: 'update',
      //     component: UpdateComponent
      //   }
    ]
  },

  // =========================
  // MYPAGE
  // =========================
  {
    path: 'mypage',
    component: WorkspaceLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
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
          }
        ]
      }
    ]
  },

  // =========================
  // WIDGET
  // =========================
  {
    path: 'widget',
    component: WidgetLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'secondbrain',
        pathMatch: 'full'
      },
      {
        path: 'secondbrain',
        component: SecondBrainWidgetComponent
      },
      {
        path: 'secondbrain/:userId',
        component: SecondBrainWidgetComponent
      },
      {
        path: 'setup',
        component: SecondBrainSetupComponent
      },
      // {
      //   path: 'connect',
      //   component: SecondBrainConnectComponent
      // },
      // {
      //   path: 'oauth-success',
      //   component: SecondBrainOauthSuccessComponent
      // },
      // {
      //   path: 'oauth-fail',
      //   component: SecondBrainOauthFailComponent
      // }
    ]
  },

  // =========================
  // Notion Auth
  // =========================
  {
    path: 'notion',
    component: WidgetLayoutComponent,
    children: [
      {
        path: 'connect',
        component: NotionConnectComponent
      },
      {
        path: 'oauth-success',
        component: NotionOauthSuccessComponent
      },
      {
        path: 'oauth-fail',
        component: NotionOauthFailComponent
      }
    ]
  },

  {
    path: 'unauthorized',
    component: UnauthorizedComponent
  },

  {
    path: '**',
    redirectTo: 'workspace/home'
  }
];

