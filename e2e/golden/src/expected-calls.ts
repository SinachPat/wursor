import type { ToolCall } from './types.ts';

export const expectedCalls: Record<string, ToolCall> = {
  'gb-01': { name: 'edit_heading', arguments: { page: 'homepage', newText: 'Welcome to My Business' } },
  'gb-02': { name: 'update_option', arguments: { key: 'blogname', value: 'Harbor Dental' } },
  'gb-03': { name: 'edit_heading', arguments: { page: 'about', newText: 'About the practice' } },
  'gb-04': {
    name: 'edit_text',
    arguments: { page: 'homepage', target: 'Family dentistry', replacement: 'Gentle dentistry' },
  },
  'gb-05': { name: 'update_option', arguments: { key: 'blog_public', value: '0' } },
  'gb-06': { name: 'edit_heading', arguments: { page: 'contact', newText: 'Call us today' } },
  'gb-07': { name: 'update_option', arguments: { key: 'blogdescription', value: 'Dentistry for the whole family' } },
  'gb-08': { name: 'edit_heading', arguments: { page: 'services', newText: 'What we offer' } },
  'gb-09': { name: 'edit_heading', arguments: { page: 'homepage', newText: 'Harbor Dental Home' } },
  'gb-10': { name: 'edit_heading', arguments: { page: 'about', newText: 'Meet the dentist' } },
  'el-01': { name: 'edit_heading', arguments: { page: 'homepage', newText: 'Evening table available' } },
  'el-02': { name: 'update_option', arguments: { key: 'blogname', value: "Nonna's Kitchen" } },
  'el-03': { name: 'edit_heading', arguments: { page: 'menu', newText: "This week's plates" } },
  'el-04': {
    name: 'edit_text',
    arguments: { page: 'homepage', target: 'Book now', replacement: 'Reserve a table' },
  },
  'el-05': { name: 'update_option', arguments: { key: 'blog_public', value: '0' } },
  'el-06': { name: 'edit_heading', arguments: { page: 'about', newText: 'The family kitchen' } },
  'el-07': { name: 'update_option', arguments: { key: 'blogdescription', value: 'Pasta, wine, and Sunday gravy' } },
  'el-08': { name: 'edit_heading', arguments: { page: 'menu', newText: 'Printed menu' } },
  'el-09': { name: 'edit_heading', arguments: { page: 'hours', newText: 'Open Tue through Sun' } },
  'el-10': { name: 'edit_heading', arguments: { page: 'location', newText: '14 Harbor Street' } },
};

export function asGrokResponse(call: ToolCall) {
  return {
    choices: [
      {
        message: {
          tool_calls: [
            {
              function: {
                name: call.name,
                arguments: JSON.stringify(call.arguments),
              },
            },
          ],
        },
      },
    ],
  };
}
