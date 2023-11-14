class ApplicationMarkdown < MarkdownRails::Renderer::Rails
  include Redcarpet::Render::SmartyPants

  FORMATTER = Rouge::Formatters::HTMLInline.new("github")

  # Enables Erb to render for the entire doc before the markdown is rendered.
  # This works great, except when you have an `erb` code fence.
  def preprocess(html)
    # Read more about this render call at https://guides.rubyonrails.org/layouts_and_rendering.html
    render inline: html, handler: :erb
  end

  def enable
    [:fenced_code_blocks]
  end

  def block_code(code, language)
    language ||= 'bash'
    lexer = Rouge::Lexer.find(language)
    content_tag :pre, class: language do
      raw FORMATTER.format(lexer.lex(code))
    end
  end
end

MarkdownRails::Handler.handle :gfm do
  ApplicationMarkdown.new
end