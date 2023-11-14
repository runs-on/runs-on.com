module PageHelper
  def title(page = nil)
    (page || current_page).data.fetch("title")
  end

  def description(page = nil)
    (page || current_page).data.fetch("description", "On-demand self-hosted GitHub Action runners of any size.")
  end

  def sorted_posts
    @sorted_posts ||= site.resources.glob("posts/*html*").sort_by{|page| Time.parse(page.data['created_at']).to_i}
  end

  def paginate(collection, current_page)
    return unless index = collection.index(current_page)
    previous_page, next_page = [index > 0 ? collection[index - 1] : nil, collection[index + 1]]
    content_tag :ul, style: "display: flex;justify-content:space-between;flex-direction:row;" do
      if previous_page
        concat(content_tag(:li, class: "previous") do
          concat "Previous: "
          concat link_to_page(previous_page)
        end)
      end
      if next_page
        concat(content_tag(:li, class: "next") do
          concat "Next: "
          concat link_to_page(next_page)
        end)
      end
    end
  end

  def post_meta(post)
    content_tag :div, style: "display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:1rem;" do
      concat link_to(image_tag(post.data.author_avatar_url, style: "width: 2rem; border-radius: 50px;"), "https://github.com/#{post.data.author_name}")
      concat content_tag(:time, l(Date.parse(post.data.created_at)), datetime: post.data.created_at, title: post.data.created_at)
      concat(content_tag(:ul, style: "padding:0rem;display:flex;flex-direction:row;gap:1rem;") do
        post.data.tags.each do |tag|
          concat post_tag tag
        end
      end)
    end
  end

  def post_tag(tag)
    content_tag :span, tag, style: "color:#{string_to_text_color(tag)};background-color:#{string_to_background_color(tag)};padding: 0 0.5rem;border-radius:5px;"
  end

  def string_to_text_color(tag)
    hue = XXhash.xxh32(tag, 100) % 360
    saturation = 90
    lightness = 50
    "hsl(#{hue}, #{saturation}%, #{lightness}%)"
  end

  def string_to_background_color(tag)
    hue = (XXhash.xxh32(tag, 100) + 180) % 360
    saturation = 80
    lightness = 60
    "hsl(#{hue}, #{saturation}%, #{lightness}%)"
  end

  def link_to_page(page)
    link_to page.data.fetch("nav_title", page.data.fetch("title", page.request_path)), page.request_path, class: { current: page == current_page }
  end

  def link_to_if_current(text, page, active_class: "active")
    if page == current_page
      link_to text, page.request_path, class: active_class
    else
      link_to text, page.request_path
    end
  end
end
