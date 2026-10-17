import { Routes } from '@angular/router';
import { SocialLoginComponent } from './components/login/social-login.component';

//import { LoginPage } from './components/login/login.page';

import { NotionConnectComponent } from './components/pages/notion-auth/connect/notion-connect.component';
import { NotionOauthSuccessComponent } from './components/pages/notion-auth/oauth-success/notion-oauth-success.component';
import { NotionOauthFailComponent } from './components/pages/notion-auth/oauth-fail/notion-oauth-fail.component';

import { NotionMigrationConnectComponent } from './components/pages/notion-migration-auth/connect/notion-migration-connect.component';
import { NotionMigrationOauthSuccessComponent } from './components/pages/notion-migration-auth/oauth-success/notion-migration-oauth-success.component';
import { NotionMigrationOauthFailComponent } from './components/pages/notion-migration-auth/oauth-fail/notion-migration-oauth-fail.component';

import { SecondBrainWidgetComponent } from './components/pages/workspace/pages/secondbrain/widget/secondbrain.widget.component';
import { SecondBrainSetupComponent } from './components/pages/workspace/pages/secondbrain/setup/secondbrain.setup.component';

import { SecondBrainConnectComponent } from './components/pages/workspace/pages/secondbrain/connect/secondbrain.connect.component';
import { SecondBrainOauthSuccessComponent } from './components/pages/workspace/pages/secondbrain/oauth-success/secondbrain.oauth-success.component';
import { SecondBrainOauthFailComponent } from './components/pages/workspace/pages/secondbrain/oauth-fail/secondbrain.oauth-fail.component';

import { ServiceManagerComponent } from './components/pages/workspace/pages/serviceManager/service-manager.component';

import { RoutineComponent } from './components/pages/workspace/pages/routine/routine.component';
import { StudioComponent } from './components/pages/workspace/pages/studio/studio.component';
import { StudioDashboardComponent } from './components/pages/workspace/pages/studio/pages/studio-dashboard/studio-dashboard.component';
import { LifeupCustomizingComponent } from './components/pages/workspace/pages/studio/pages/lifeup-customizing/lifeup-customizing.component';
import { LifeupMigrationComponent } from './components/pages/workspace/pages/care/lifeup-migration/lifeup-migration.component'; 

import { RoutineFindComponent } from './components/pages/workspace/pages/routine/pages/rountine-find/routine-find.component';
import { MyRoutineComponent } from './components/pages/workspace/pages/routine/pages/my-rountine/my-routine.component';
import { RoutineDashboardComponent } from './components/pages/workspace/pages/routine/pages/routine-dashboard/routine-dashboard.component';
import { AutoManagerComponent } from './components/pages/workspace/pages/auto-manager/auto-manager.component';
import { AutoComponent } from './components/pages/workspace/pages/auto/auto.component';

import { MyPageComponent } from './components/pages/myPage/myPage.component';
import { ProfileComponent } from './components/pages/myPage/pages/profile/profile.component';
import { SecurityComponent } from './components/pages/myPage/pages/security/security.component';
import { SubscriptionComponent } from './components/pages/myPage/pages/subscription/subscription.component';
import { NotificationComponent } from './components/pages/myPage/pages/notification/notification.component';
import { LifeupDownloadComponent } from './components/pages/myPage/pages/lifeup-download/lifeup-download.component';

import { WorkspaceLayoutComponent } from './workspace-layout.component';
import { WidgetLayoutComponent } from './widget-layout.component';
import { EventLogComponent } from './components/pages/workspace/pages/event-log/event-log.component';
import { LifeupTemplateSettingsComponent } from './components/pages/workspace/pages/studio/pages/lifeup-template-settings/lifeup-template-settings.component';
import { UnsubscribeComponent } from './components/pages/unsubscribe/unsubscribe.component';
import { WorkspaceComponent } from './components/pages/workspace/workspace.component';
import { LifeupScrapbookUpgradeComponent } from './components/pages/upgrade/lifeup-scrapbook-upgrade.component';
import { StoreRedirectComponent } from './components/pages/store-redirect/store-redirect.component';
//import { WorkspaceHomeComponent } from './components/pages/workspace-home/workspace-home.component';
//import { UpdateComponent } from './components/pages/life-up/pages/update/update.component';

import { UnauthorizedComponent } from './components/login/app-unauthorized.component';

import { memberGuard } from './services/auth.guard';
import { AgentConnectComponentComponent } from './components/pages/workspace/pages/agent-connect/agent-connect-component.component';

export const routes: Routes = [
  { path: 'verify-purchase', component: LifeupDownloadComponent, data: { verificationOnly: true } },
  { path: 'store/lifeup', component: StoreRedirectComponent },
  { path: 'store/lifeup-r', component: StoreRedirectComponent },
  { path: 'store/lifeup-reward', component: StoreRedirectComponent },
  { path: 'store/lifeup-reward-sale', component: StoreRedirectComponent },
  { path: 'store/lifeup-reward-pack', component: StoreRedirectComponent },
  { path: 'store/lifeup-reward-pack-sale', component: StoreRedirectComponent },
  { path: 'store/lifeup-imweb', component: StoreRedirectComponent },
  { path: 'store/lifeup-planner', component: StoreRedirectComponent },
  { path: 'store/lifeup-planner-reward', component: StoreRedirectComponent },
  { path: 'store/lifeup-planner-reward-sale', component: StoreRedirectComponent },
  { path: 'download/lifeup-planner', component: LifeupDownloadComponent, data: { product: 'lifeupPlanner' } },
  { path: 'store/lifeup-scrapbook', component: StoreRedirectComponent },
  { path: 'store/bizup-custom', component: StoreRedirectComponent },
  { path: 'upgrade/lifeup-scrapbook', component: LifeupScrapbookUpgradeComponent, data: { templateId: 'lifeUpScrapbook' } },
  { path: 'upgrade/lifeup-planner', component: LifeupScrapbookUpgradeComponent, data: { templateId: 'lifeupPlanner' } },
  { path: 'gift/lifeupfree', loadComponent: () => import('./components/pages/lifeup-free/lifeup-free.component').then(m => m.LifeupFreeComponent) },
  { path: 'gift/lifeupfree/lifeup-scrapbook', loadComponent: () => import('./components/pages/lifeup-free/lifeup-free.component').then(m => m.LifeupFreeComponent) },
  { path: 'invite/lifeup', loadComponent: () => import('./components/pages/purchase-invitation/purchase-invitation.component').then(m => m.PurchaseInvitationComponent) },
  { path: 'block', component: UnsubscribeComponent },
  { path: 'unsubscribe', redirectTo: 'block', pathMatch: 'full' },
  { path: 'login', component: SocialLoginComponent },
  {
    path: 'download/lifeup',
    component: LifeupDownloadComponent
  },
  {
    path: 'download/lifeup-scrapbook',
    component: LifeupDownloadComponent,
    data: { product: 'lifeUpScrapbook' }
  },
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
    runGuardsAndResolvers: 'always',
    canActivateChild: [memberGuard],
    component: WorkspaceLayoutComponent,
    canActivate: [memberGuard],
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        component: WorkspaceComponent
      },
      {
        path: 'admin/lifeup-care',
        loadComponent: () => import('./components/pages/workspace/pages/care/lifeup-care/lifeup-care.component').then(m => m.LifeupCareComponent),
        data: { adminView: true }
      },
      {
        path: 'admin/purchasers',
        loadComponent: () => import('./components/pages/workspace/pages/purchaser-admin/purchaser-admin.component').then(m => m.PurchaserAdminComponent)
      },
      {
        path: 'admin/customers',
        loadComponent: () => import('./components/pages/workspace/pages/customer-admin/customer-admin.component').then(m => m.CustomerAdminComponent)
      },
      {
        path: 'admin/mail',
        loadComponent: () => import('./components/pages/workspace/pages/mail-admin/mail-admin.component').then(m => m.MailAdminComponent)
      },
      {
        path: 'admin/marketing-blocks',
        loadComponent: () => import('./components/pages/workspace/pages/marketing-block-admin/marketing-block-admin.component').then(m => m.MarketingBlockAdminComponent)
      },
      {
        path: 'admin/members',
        loadComponent: () => import('./components/pages/workspace/pages/member-admin/member-admin.component').then(m => m.MemberAdminComponent)
      },
      {
        path: 'admin/sales',
        loadComponent: () => import('./components/pages/workspace/pages/sales-admin/sales-admin.component').then(m => m.SalesAdminComponent)
      },
      {
        path: 'connect',
        component: AgentConnectComponentComponent
      },
      {
        path: 'care',
        children: [
          {
            path: '',
            loadComponent: () => import('./components/pages/workspace/pages/care/lifeup-care/lifeup-care.component').then(m => m.LifeupCareComponent),
            pathMatch: 'full'
          },
          {
            path: 'migration',
            component: LifeupMigrationComponent
          },
          {
            path: 'template-transfer',
            component: LifeupMigrationComponent,
            data: { migrationMode: 'template-v15-to-lifeup-v15' }
          }
        ]
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
        path: 'routine',
        component: RoutineComponent,
        children: [
          {
            path: '',
            redirectTo: 'dashboard',
            pathMatch: 'full'
          },
          {
            path: 'dashboard',
            component: RoutineDashboardComponent
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
        path: 'studio',
        component: StudioComponent,
        children: [
          {
            path: '',
            redirectTo: 'dashboard',
            pathMatch: 'full'
          },
          {
            path: 'dashboard',
            component: StudioDashboardComponent
          },
          {
            path: 'template',
            component: LifeupTemplateSettingsComponent
          },
          {
            path: 'care',
            redirectTo: '/workspace/care',
            pathMatch: 'full'
          },
          {
            path: 'customizing',
            component: LifeupCustomizingComponent
          }
        ]
      },
      {
        path: 'auto',
        component: AutoComponent,
        children: [
          { path: '', redirectTo: 'manage', pathMatch: 'full' },
          { path: 'manage', component: AutoManagerComponent },
          { path: 'log', component: EventLogComponent },
          { path: 'log/:agentId', component: EventLogComponent }
        ]
      },
      {
        path: 'event-log',
        redirectTo: 'auto/log',
        pathMatch: 'full'
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
    runGuardsAndResolvers: 'always',
    canActivateChild: [memberGuard],
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

  // =========================
  // Notion Auth
  // =========================
  {
    path: 'notion-migration-auth',
    component: WidgetLayoutComponent,
    children: [
      {
        path: 'connect',
        component: NotionMigrationConnectComponent
      },
      {
        path: 'success',
        component: NotionMigrationOauthSuccessComponent
      },
      {
        path: 'fail',
        component: NotionMigrationOauthFailComponent
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
