import { Routes } from '@angular/router';

//import { LoginPage } from './components/login/login.page';

import { NotionConnectComponent } from './components/pages/notion-auth/connect/notion-connect.component';
import { NotionOauthSuccessComponent } from './components/pages/notion-auth/oauth-success/notion-oauth-success.component';
import { NotionOauthFailComponent } from './components/pages/notion-auth/oauth-fail/notion-oauth-fail.component';


import { SecondBrainWidgetComponent } from './components/pages/workspace/pages/secondbrain/widget/secondbrain.widget.component';
import { SecondBrainSetupComponent } from './components/pages/workspace/pages/secondbrain/setup/secondbrain.setup.component';

import { SecondBrainConnectComponent } from './components/pages/workspace/pages/secondbrain/connect/secondbrain.connect.component';
import { SecondBrainOauthSuccessComponent } from './components/pages/workspace/pages/secondbrain/oauth-success/secondbrain.oauth-success.component';
import { SecondBrainOauthFailComponent } from './components/pages/workspace/pages/secondbrain/oauth-fail/secondbrain.oauth-fail.component';

import { ServiceManagerComponent } from './components/pages/workspace/pages/serviceManager/service-manager.component';

import { RoutineComponent } from './components/pages/workspace/pages/routine/routine.component';
import { RoutineFindComponent } from './components/pages/workspace/pages/routine/pages/rountine-find/routine-find.component';
import { MyRoutineComponent } from './components/pages/workspace/pages/routine/pages/my-rountine/my-routine.component';
import { AutoManagerComponent } from './components/pages/workspace/pages/auto-manager/auto-manager.component';

import { MyPageComponent } from './components/pages/myPage/myPage.component';
import { ProfileComponent } from './components/pages/myPage/pages/profile/profile.component';
import { SecurityComponent } from './components/pages/myPage/pages/security/security.component';
import { SubscriptionComponent } from './components/pages/myPage/pages/subscription/subscription.component';
import { NotificationComponent } from './components/pages/myPage/pages/notification/notification.component';

import { WorkspaceLayoutComponent } from './workspace-layout.component';
import { WidgetLayoutComponent } from './widget-layout.component';
import { EventLogComponent } from './components/pages/workspace/pages/event-log/event-log.component';

import { WorkspaceComponent } from './components/pages/workspace/workspace.component';
//import { WorkspaceHomeComponent } from './components/pages/workspace-home/workspace-home.component';
//import { UpdateComponent } from './components/pages/life-up/pages/update/update.component';

import { UnauthorizedComponent } from './components/login/app-unauthorized.component';

import { memberGuard } from './services/auth.guard';
import { AgentConnectComponentComponent } from './components/pages/workspace/pages/agent-connect-component/agent-connect-component.component';

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
    canActivate: [memberGuard],
    children: [
      {
        path: 'home',
        component: WorkspaceComponent
      },
      {
        path: 'connect',
        component: AgentConnectComponentComponent
      },
      {
        path: 'secondbrain',
        component: SecondBrainWidgetComponent
      },
      {
        path: 'secondbrain/:userId',
        component: SecondBrainWidgetComponent
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
            redirectTo: 'myroutine',
            pathMatch: 'full'
          },
          {
            path: 'find',
            component: RoutineFindComponent
          },
          {
            path: 'myroutine',
            component: MyRoutineComponent
          }
        ]
      },
      {
        path: 'auto',
        component: AutoManagerComponent
      },
      {
        path: 'event-log',
        component: EventLogComponent
      },
      {
        path: 'event-log/:agentId',
        component: EventLogComponent
      }
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
    canActivate: [memberGuard],
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
      {
        path: 'connect',
        component: SecondBrainConnectComponent
      },
      {
        path: 'oauth-success',
        component: SecondBrainOauthSuccessComponent
      },
      {
        path: 'oauth-fail',
        component: SecondBrainOauthFailComponent
      }
    ]
  },

  // =========================
  // Notion Auth
  // =========================
  {
    path: 'notion-auth',
    component: WidgetLayoutComponent,
    children: [
      {
        path: 'connect',
        component: NotionConnectComponent
      },
      {
        path: 'success',
        component: NotionOauthSuccessComponent
      },
      {
        path: 'fail',
        component: NotionOauthFailComponent
      }
    ]
  },

  /////////////////////////////////////////////////////////////////////////////////////
  // 기존 주소 유지 

  {
    path: 'secondbrain',
    component: WidgetLayoutComponent,
    children: [
      {
        path: '',
        component: SecondBrainWidgetComponent
      },
      {
        path: 'widget',
        component: SecondBrainWidgetComponent
      },
      {
        path: 'widget/:userId',
        component: SecondBrainWidgetComponent
      },
      {
        path: 'setup',
        component: SecondBrainSetupComponent
      },
      {
        path: 'connect',
        component: SecondBrainConnectComponent
      },
      {
        path: 'oauth-success',
        component: SecondBrainOauthSuccessComponent
      },
      {
        path: 'oauth-fail',
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
    redirectTo: 'workspace'
  }
];


//https://app.notionable.net/secondbrain/widget