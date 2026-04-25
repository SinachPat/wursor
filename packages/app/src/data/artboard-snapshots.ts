import type { ComponentSnapshot } from '@originmain/diff-engine';

interface ArtboardSnapshots {
  before: ComponentSnapshot;
  after: ComponentSnapshot;
}

const dashboardCard: ArtboardSnapshots = {
  before: {
    id: 'dashboard-card',
    name: 'DashboardCard',
    filePath: 'src/components/DashboardCard.tsx',
    props: {
      title: 'Revenue Overview',
      value: '$12,450',
      delta: 2.4,
      period: 'monthly',
      loading: false,
    },
    styles: {
      borderRadius: '8px',
      accentColor: '#2A6CD4',
      padding: '16',
    },
  },
  after: {
    id: 'dashboard-card',
    name: 'DashboardCard',
    filePath: 'src/components/DashboardCard.tsx',
    props: {
      title: 'Revenue Overview',
      value: '$12,450',
      delta: 2.4,
      period: 'monthly',
      loading: false,
    },
    styles: {
      borderRadius: '12px',
      accentColor: '#0066FF',
      padding: '20',
    },
  },
};

const userProfile: ArtboardSnapshots = {
  before: {
    id: 'user-profile',
    name: 'UserProfile',
    filePath: 'src/components/UserProfile.tsx',
    props: {
      name: 'Sarah Chen',
      role: 'Designer',
      plan: 'Pro',
      avatarSize: 40,
    },
    styles: {
      avatarGradient: 'linear-gradient(135deg, #6D28D9, #2563EB)',
      buttonVariant: 'outline',
    },
  },
  after: {
    id: 'user-profile',
    name: 'UserProfile',
    filePath: 'src/components/UserProfile.tsx',
    props: {
      name: 'Sarah Chen',
      role: 'Design Engineer',
      plan: 'Team',
      avatarSize: 52,
    },
    styles: {
      avatarGradient: 'linear-gradient(135deg, #7C3AED, #0066FF)',
      buttonVariant: 'ghost',
    },
  },
};

const navSidebar: ArtboardSnapshots = {
  before: {
    id: 'nav-sidebar',
    name: 'NavSidebar',
    filePath: 'src/components/NavSidebar.tsx',
    props: {
      brand: 'Origin',
      collapsed: false,
      activeItem: 'Dashboard',
    },
    styles: {
      background: '#F5F5F5',
      itemPadding: '6px 10px',
      borderRadius: '4px',
    },
  },
  after: {
    id: 'nav-sidebar',
    name: 'NavSidebar',
    filePath: 'src/components/NavSidebar.tsx',
    props: {
      brand: 'Originmain',
      collapsed: false,
      activeItem: 'Dashboard',
    },
    styles: {
      background: '#FAFAFA',
      itemPadding: '7px 12px',
      borderRadius: '5px',
    },
  },
};

const dataTable: ArtboardSnapshots = {
  before: {
    id: 'data-table',
    name: 'DataTable',
    filePath: 'src/components/DataTable.tsx',
    props: {
      title: 'Components',
      striped: false,
      pageSize: 10,
    },
    styles: {
      headerColor: '#71717A',
      rowHeight: '32px',
    },
  },
  after: {
    id: 'data-table',
    name: 'DataTable',
    filePath: 'src/components/DataTable.tsx',
    props: {
      title: 'Component Inventory',
      striped: true,
      pageSize: 10,
    },
    styles: {
      headerColor: '#A1A1AA',
      rowHeight: '36px',
    },
  },
};

export const ARTBOARD_SNAPSHOTS: Record<string, ArtboardSnapshots> = {
  'dashboard-card': dashboardCard,
  'user-profile': userProfile,
  'nav-sidebar': navSidebar,
  'data-table': dataTable,
};
