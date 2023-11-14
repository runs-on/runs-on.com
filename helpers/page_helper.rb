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

  def link_to_page(page)
    link_to page.data.fetch("nav_title", page.data.fetch("title", page.request_path)), page.request_path
  end

  def link_to_if_current(text, page, active_class: "active")
    if page == current_page
      link_to text, page.request_path, class: active_class
    else
      link_to text, page.request_path
    end
  end
end
