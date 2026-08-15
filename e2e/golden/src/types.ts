export type Builder = 'elementor' | 'beaver' | 'divi' | 'gutenberg' | 'classic';

export type PluginRef = {
  slug: string;
  active: boolean;
};

export type PostFixture = {
  id: number;
  slug: string;
  title: string;
  content: string;
  meta: Record<string, string>;
};

export type SiteFixture = {
  id: string;
  theme: string;
  plugins: PluginRef[];
  wordpressVersion: string;
  phpVersion: string;
  options: Record<string, string>;
  posts: PostFixture[];
  uploads: { path: string; bytes: number }[];
};

export type PreviewTextAssert = {
  type: 'preview_text';
  page: string;
  contains: string;
};

export type OptionAssert = {
  type: 'option';
  key: string;
  value: string;
};

export type ScreenshotAssert = {
  type: 'screenshot';
  page: string;
  contains: string;
};

export type GoldenAssert = PreviewTextAssert | OptionAssert | ScreenshotAssert;

export type GoldenPrompt = {
  id: string;
  site: string;
  prompt: string;
  assert: GoldenAssert;
};

export type ToolName = 'edit_heading' | 'edit_text' | 'update_option';

export type ToolCall = {
  name: ToolName;
  arguments: Record<string, string>;
};

export type GrokResponse = {
  choices: Array<{
    message: {
      tool_calls?: Array<{
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
};

export type SiteExport = {
  origin: string;
  tables: Record<string, Array<Record<string, string | number>>>;
  uploads: { path: string; bytes: number }[];
};

export type SubsetRequest = {
  playbook: 'content' | 'design' | 'plugin';
  postIds: number[];
};

export type SubsetResult = {
  tables: string[];
  options: string[];
};
