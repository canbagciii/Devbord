// Utility function to extract plain text from Jira ADF (Atlassian Document Format)
export const getPlainTextFromJiraAdf = (content: any): string => {
  if (typeof content === 'string') {
    return content;
  }
  
  if (!content || typeof content !== 'object') {
    return '';
  }
  
  // Handle arrays
  if (Array.isArray(content)) {
    return content.map(item => getPlainTextFromJiraAdf(item)).join(' ').trim();
  }
  
  // Handle ADF format
  if (content.type === 'doc' && content.content) {
    return extractTextFromAdfContent(content.content);
  }
  
  // Handle direct content array
  if (content.content && Array.isArray(content.content)) {
    return extractTextFromAdfContent(content.content);
  }
  
  // Handle text nodes directly
  if (content.type === 'text' && content.text) {
    return content.text;
  }
  
  // Handle other node types that might contain text
  if (content.type === 'paragraph' && content.content) {
    return extractTextFromAdfContent(content.content);
  }
  
  // Fallback: return empty string for any unhandled object
  return '';
};

const extractTextFromAdfContent = (content: any[]): string => {
  if (!Array.isArray(content)) {
    return '';
  }
  
  return content.map(node => {
    if (!node || typeof node !== 'object') {
      return '';
    }
    
    if (node.type === 'paragraph' && node.content) {
      return extractTextFromAdfContent(node.content);
    }
    if (node.type === 'text' && node.text) {
      return node.text;
    }
    if (node.type === 'mention' && node.attrs && node.attrs.text) {
      return node.attrs.text;
    }
    if (node.type === 'hardBreak') {
      return '\n';
    }
    if (node.type === 'inlineCard' && node.attrs && node.attrs.url) {
      return node.attrs.url;
    }
    if (node.content) {
      return extractTextFromAdfContent(node.content);
    }
    return '';
  }).join(' ').trim();
};