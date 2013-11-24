/**
 * Issues dashboard visualizes issues
 * from various platforms in a single user interface.
 *
 * Copyright (c) 2013, Dirk Thomas
 * Distributed under the BSD 2-Clause license
 * https://github.com/dirk-thomas/issues_dashboard/
 **/

(function(namespace) {

  /*
   * An issue model has the following attributes:
   * - id
   * - number
   * - title
   * - issue_url
   * - creator
   * - assignee
   * - assignee_is_me
   * - pull_request
   * - updated_at
   * - labels[]
   *   - label
   *   - color
   *   matches_filter (populated by the IssueView)
   */
  namespace.IssueModel = Backbone.Model.extend({
    initialize: function() {
      this.listenTo(this, 'change', this.change);
    },
    change: function(model, options) {
      var old_index = this.collection.indexOf(this);
      this.collection.sort({silent: true});
      var new_index = this.collection.indexOf(this);
      if (old_index != new_index) {
        this.trigger('change_index', this, old_index, new_index);
      }
    },
  });

  namespace.IssueCollection = Backbone.Collection.extend({
    model: namespace.IssueModel,
    // plain attribute comparator fails to order descending:
    /*comparator: function(model) {
      return - model.get('updated_at');
    },*/
    comparator: function(a, b) {
      a = a.get('updated_at');
      b = b.get('updated_at');
      // inverted order
      if (a < b) return 1;
      if (a > b) return -1;
      return 0;
    },
  });

  namespace.IssueView = Backbone.View.extend({
    tagName: 'div',
    className: 'issue',
    template: _.template($('#issue-template').html()),
    initialize: function() {
      console.debug('IssueView.initialize()');
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change:assignee', this.update_filter_match);
      this.listenTo(this.model, 'change_index', this.change_index);
      this.listenTo(this.model, 'destroy', this.remove);
      this.listenTo(this.options.filter_model, 'change', this.update_filter_match);
      this.update_filter_match();
    },
    render: function() {
      console.debug('IssueView.render() issue #' + this.model.get('number'));
      this.$el.html(this.template(this.model.toJSON()));
      return this;
    },
    update_filter_match: function() {
      console.debug('IssueView.update_filter_match()');
      old_matches_filter = this.model.get('matches_filter');
      matches_filter = this.options.filter_model.match_issue(this.model);
      if (matches_filter) {
        this.$el.show();
      } else {
        this.$el.hide();
      }
      console.debug('IssueView.update_filter_match() ' + this.model.get('matches_filter'));
      this.model.set({matches_filter: matches_filter});
    },
    change_index: function(model, old_index, new_index) {
      console.debug('IssueView.change_index() issue #' + model.get('number') + ' to index ' + new_index);
      if (new_index == 0) {
        this.$el.parent().prepend(this.$el);
      } else {
        this.$el.parent().children(this.tagName + ':eq(' + (new_index - 1).toString() + ')').after(this.$el);
      }
    },
  });

  namespace.IssueListView = Backbone.View.extend({
    tagName: 'div',
    className: 'issuelist',
    initialize: function() {
      console.debug('IssueListView.initialize()');
      this.listenTo(this.collection, 'add', this.addOne);
      this.listenTo(this.collection, 'reset', this.addAll);
      this.listenTo(this.collection, 'remove', this.removeOne);
      this.listenTo(this.collection, 'sort', this.render);
    },
    render: function() {
      console.debug('IssueListView.render()');
      return this;
    },
    addOne: function(model) {
      var view = new namespace.IssueView({
        model: model,
        filter_model: this.options.filter_model,
      });
      index = this.collection.indexOf(model);
      view_at_index = this._get_element_of_index(index);
      if (view_at_index.length) {
        console.debug('IssueListView.addOne() issue #' + model.get('number') + ' at index ' + index.toString());
        view_at_index.before(view.render().el);
      } else {
        console.debug('IssueListView.addOne() issue #' + model.get('number') + ' at the end');
        this.$el.append(view.render().el);
      }
    },
    addAll: function() {
      console.debug('IssueListView.addAll()');
      this.$el.html('');
      this.collection.each(this.addOne, this);
    },
    removeOne: function(model, collection, options) {
      console.debug('IssueListView.removeOne() issue #' + model.get('number'));
      this._get_element_of_index(options.index).remove();
    },
    _get_element_of_index: function (index) {
      return this.$('>' + namespace.IssueView.prototype.tagName + ':eq(' + index.toString() + ')');
    }
  });


  /*
   * A repository model has the following attributes:
   * - id
   * - name
   * - full_name
   * - repo_url
   * - open_issues_url
   * - open_issue_count
   * - matched_issue_count (populated by the RepositoryView, aggregated from the collection of IssueModels)
   */
  namespace.RepositoryModel = Backbone.Model.extend({
  });

  namespace.RepositoryCollection = Backbone.Collection.extend({
    model: namespace.RepositoryModel,
    comparator: function(model) {
      return model.get('full_name').toLowerCase();
    },
  });

  namespace.RepositoryView = Backbone.View.extend({
    tagName: 'div',
    className: 'repo',
    template: _.template($('#repo-header-template').html()),
    events: {
      'click a': 'skip_event',
      'click .repo_header': 'toggle_issuelist',
      'click .query_issues': 'query_issues',
    },
    initialize: function() {
      console.debug('RepositoryView.initialize()');
      this.$el.html('<div class="repo_header"></div>');
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'destroy', this.remove);
      this.issues_queried = false;
      this.issuelist_folded = true;

      this.issue_collection = new namespace.IssueCollection();
      this.listenTo(this.issue_collection, 'add', this.update_matched_issue_count);
      this.listenTo(this.issue_collection, 'remove', this.update_matched_issue_count);
      this.listenTo(this.issue_collection, 'reset', this.update_matched_issue_count);
      this.listenTo(this.issue_collection, 'change:matches_filter', this.change_matches_filter);
      var view = new namespace.IssueListView({
        collection: this.issue_collection,
        filter_model: this.options.filter_model,
      });
      this.$el.append(view.render().el);
    },
    render: function() {
      console.debug('RepositoryView.render() full_name: ' + this.model.get('full_name'));
      // can't use a default value in order to not overwrite values
      // when models are updated with new models from the provider
      missing = !this.model.has('matched_issue_count');
      if (missing) {
        this.model.set({matched_issue_count: null}, {silent: true});
      }
      this.$('.repo_header').html(this.template(this.model.toJSON()));
      if (missing) {
        this.model.unset('matched_issue_count', {silent: true});
      }
      this.$('.repo_header .loader').hide();
      if (this.issuelist_folded) {
        this.$('.icon-folder-open').hide();
        this.$('.issuelist').hide();
      } else {
        this.$('.icon-folder-close').hide();
        this.$('.issuelist').show();
      }
      return this;
    },
    skip_event: function(event) {
      event.stopPropagation();
    },
    toggle_issuelist: function() {
      console.log('RepositoryView.toggle_issuelist() full_name: ' + this.model.get('full_name'));
      if (!this.issues_queried) {
        this.query_issues();
      } else if (this.issuelist_folded) {
        this.show_issues();
      } else {
        this.hide_issues();
      }
    },
    query_issues: function(event) {
      console.log('RepositoryView.query_issues() full_name: ' + this.model.get('full_name'));
      if (event) {
        event.stopPropagation();
      }
      this.$('.repo_header .query_issues').hide();
      this.$('.repo_header .loader').show();
      this.options.query_repo_issues(this.model, this.issue_collection, $.proxy(this.query_issues_completed, this));
    },
    query_issues_completed: function() {
      this.$('.repo_header .query_issues').css('display', '');
      this.$('.repo_header .loader').hide();
      if (!this.issues_queried) {
        this.show_issues();
        this.issues_queried = true;
      }
    },
    show_issues: function() {
      console.debug('RepositoryView.show_issues() full_name: ' + this.model.get('full_name'));
      this.$('.icon-folder-close').hide();
      this.$('.icon-folder-open').show();
      if (this.issue_collection.length > 0) {
        this.$('.issuelist').show();
        height = this.$('.issuelist').css('height', 'auto').height();
        this.$('.issuelist').height(0);
        issuelist = this.$('.issuelist')
        this.$('.issuelist').animate({'height': height + 'px'}, {speed: 200, queue: false, always: function(){
          issuelist.height('auto');
        }});
      }
      this.issuelist_folded = false;
    },
    hide_issues: function() {
      console.debug('RepositoryView.hide_issues() full_name: ' + this.model.get('full_name'));
      this.$('.icon-folder-close').show();
      this.$('.icon-folder-open').hide();
      issuelist = this.$('.issuelist');
      this.$('.issuelist').animate({'height': '0px'}, {speed: 200, queue: false, always: function(){
        issuelist.hide();
      }});
      this.issuelist_folded = true;
    },
    update_matched_issue_count: function() {
      console.debug('RepositoryView.update_matched_issue_count() full_name: ' + this.model.get('full_name'));
      if (this.issue_collection.length) {
        matched_issue_count = 0;
        filter_model = this.options.filter_model;
        this.issue_collection.each(function(issue_model, index) {
          if (issue_model.get('matches_filter')) {
            matched_issue_count += 1;
          }
        });
        console.debug('RepositoryView.update_matched_issue_count() full_name: ' + this.model.get('full_name') + ' ' + matched_issue_count);
        this.model.set({matched_issue_count: matched_issue_count});
      } else {
        console.debug('RepositoryView.update_matched_issue_count() full_name: ' + this.model.get('full_name') + ' reset to null');
        this.model.set({matched_issue_count: null});
      }
    },
    change_matches_filter: function(issue_model) {
      offset = 1;
      if (!issue_model.get('matches_filter')) {
        offset = -1;
      }
      this.model.set({matched_issue_count: this.model.get('matched_issue_count') + offset});
    },
  });

  namespace.RepositoryListView = Backbone.View.extend({
    tagName: 'div',
    className: 'repolist',
    initialize: function() {
      console.debug('RepositoryListView.initialize()');
      this.listenTo(this.collection, 'add', this.addOne);
      this.listenTo(this.collection, 'reset', this.addAll);
      this.listenTo(this.collection, 'remove', this.removeOne);
    },
    render: function() {
      console.debug('RepositoryListView.render()');
      return this;
    },
    addOne: function(model) {
      var view = new namespace.RepositoryView({
        model: model,
        filter_model: this.options.filter_model,
        query_repo_issues: this.options.query_repo_issues,
      });
      index = this.collection.indexOf(model);
      view_at_index = this._get_element_of_index(index);
      if (view_at_index.length) {
        console.debug('RepositoryListView.addOne() repo ' + model.get('full_name') + ' at index ' + index.toString());
        view_at_index.before(view.render().el);
      } else {
        console.debug('RepositoryListView.addOne() repo ' + model.get('full_name') + ' at the end');
        this.$el.append(view.render().el);
      }
    },
    addAll: function() {
      console.debug('RepositoryListView.addAll()');
      this.$el.html('');
      this.collection.each(this.addOne, this);
    },
    removeOne: function(model, collection, options) {
      console.debug('RepositoryListView.removeOne() repo: ' + model.get('full_name'));
      this._get_element_of_index(options.index).remove();
    },
    _get_element_of_index: function (index) {
      return this.$('>' + namespace.RepositoryView.prototype.tagName + ':eq(' + index.toString() + ')');
    }
  });


  /*
   * A group model has the following attributes:
   * - id
   * - name
   * - avatar_url
   * - open_issue_count (populated by the GroupView, aggregated from the collection of RepositoryModels)
   * - matched_issue_count (populated by the GroupView, aggregated from the collection of RepositoryModels)
   */
  namespace.GroupModel = Backbone.Model.extend({
    defaults: {
      'open_issue_count': 0,
      'matched_issue_count': null,
    },
  });

  namespace.GroupCollection = Backbone.Collection.extend({
    model: namespace.GroupModel,
    comparator: function(model) {
      return model.get('name').toLowerCase();
    },
  });

  namespace.GroupView = Backbone.View.extend({
    tagName: 'div',
    className: 'group',
    template: _.template($('#group-header-template').html()),
    events: {
      'click a': 'skip_event',
      'click .group_header': 'toggle_repolist',
      'click .query_repos': 'query_repos',
    },
    initialize: function() {
      console.debug('GroupView.initialize()');
      this.$el.html('<div class="group_header"></div>');
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'destroy', this.remove);
      this.repolist_state = null;

      this.repository_collection = new namespace.RepositoryCollection();
      this.listenTo(this.repository_collection, 'add', this.add_repo);
      this.listenTo(this.repository_collection, 'remove', this.remove_repo);
      this.listenTo(this.repository_collection, 'reset', this.reset_repos);
      this.listenTo(this.repository_collection, 'change:matched_issue_count', this.update_matched_issue_count);
      var view = new namespace.RepositoryListView({
        collection: this.repository_collection,
        filter_model: this.options.filter_model,
        query_repo_issues: this.options.query_repo_issues,
      });
      this.$el.append(view.render().el);
    },
    render: function() {
      console.debug('GroupView.render() group: ' + this.model.get('name'));
      this.$('.group_header').html(this.template(this.model.toJSON()));
      this.$('.group_header .loader').hide();
      if (this.repository_collection.length == 0) {
        this.$('.repolist').hide();
      }
      return this;
    },
    skip_event: function(event) {
      event.stopPropagation();
    },
    toggle_repolist: function() {
      console.log('GroupView.toggle_repolist() group: ' + this.model.get('name'));
      if (this.repolist_state === null) {
        this.query_repos();
      } else if (this.repolist_state) {
        this.hide_repos();
      } else {
        this.show_repos();
      }
    },
    query_repos: function(event) {
      console.debug('GroupView.query_repos() group: ' + this.model.get('name'));
      if (event) {
        event.stopPropagation();
      }
      this.$('.group_header .query_repos').hide();
      this.$('.group_header .loader').show();
      this.options.query_group_repos(this.model, this.repository_collection, $.proxy(this.query_repos_completed, this));
    },
    query_repos_completed: function() {
      this.$('.group_header .query_repos').css('display', '');
      this.$('.group_header .loader').hide();
    },
    show_repos: function() {
      console.debug('GroupView.show_repos() group: ' + this.model.get('name'));
      if (this.repository_collection.length > 0) {
        this.$('.repolist').show();
        height = this.$('.repolist').css('height', 'auto').height();
        this.$('.repolist').height(0);
        repolist = this.$('.repolist');
        this.$('.repolist').animate({'height': height + 'px', 'margin-top': '5px'}, {speed: 200, queue: false, always: function(){
          repolist.height('auto');
        }});
        this.repolist_state = true;
      }
    },
    hide_repos: function() {
      console.debug('GroupView.hide_repos() group: ' + this.model.get('name'));
      repolist = this.$('.repolist');
      this.$('.repolist').animate({'height': '0px', 'margin-top': '0px'}, {speed: 200, queue: false, always: function(){
        repolist.hide();
      }});
      this.repolist_state = false;
    },
    add_repo: function(repo_model) {
      console.debug('GroupView.add_repo() group: ' + this.model.get('name') + ' repo ' + repo_model.get('full_name'));
      this.show_repos();

      count = repo_model.get('open_issue_count');
      this.model.set({open_issue_count: this.model.get('open_issue_count') + count});
    },
    remove_repo: function(repo_model) {
      console.debug('GroupView.remove_repo() group: ' + this.model.get('name') + ' repo ' + repo_model.get('full_name'));
      if (this.repository_collection.length == 0) {
        this.hide_repos();
      }

      count = repo_model.get('open_issue_count');
      this.model.set({open_issue_count: this.model.get('open_issue_count') - count});
    },
    reset_repos: function(repo_models) {
      console.debug('GroupView.reset_repos() group: ' + this.model.get('name'));
      if (this.repository_collection.length > 0) {
        this.show_repos();
      } else {
        this.hide_repos();
      }
      this.update_open_issue_count();
    },
    update_open_issue_count: function() {
      console.debug('GroupView.update_open_issue_count() group: ' + this.model.get('name'));
      open_issue_count = 0;
      this.repository_collection.each(function(repo_model, index) {
        open_issue_count += repo_model.get('open_issue_count')
      });
      this.model.set({open_issue_count: open_issue_count});
    },
    update_matched_issue_count: function(repo_model) {
      console.debug('GroupView.update_matched_issue_count() group: ' + this.model.get('name'));
      model_count = this.model.get('matched_issue_count');
      repo_model_previous_count = repo_model.previous('matched_issue_count');
      if (model_count != null && repo_model_previous_count != null && typeof repo_model_previous_count != 'undefined') {
        // update group model only by offset of repo model
        offset = repo_model.get('matched_issue_count') - repo_model_previous_count;
        console.debug('GroupView.update_matched_issue_count() group: ' + this.model.get('name') + ' offset ' + offset);
        this.model.set({matched_issue_count: model_count + offset});
      } else {
        // calculate sum of all repo models
        matched_issue_count = 0;
        this.repository_collection.each(function(repo_model, index) {
          count = repo_model.get('matched_issue_count');
          if (count != null) {
            //console.debug('GroupView.update_matched_issue_count() repo ' + repo_model.get('full_name') + ' count ' + count);
            matched_issue_count += count;
          } else {
            //console.debug('GroupView.update_matched_issue_count() repo ' + repo_model.get('full_name') + ' "null" ' + count);
            matched_issue_count += repo_model.get('open_issue_count');
          }
        });
        //console.debug('GroupView.update_matched_issue_count() group: ' + this.model.get('name') + ' all ' + matched_issue_count);
        this.model.set({matched_issue_count: matched_issue_count});
      }
    },
  });

  namespace.GroupListView = Backbone.View.extend({
    tagName: 'div',
    className: 'grouplist',
    initialize: function() {
      console.debug('GroupListView.initialize()');
      this.listenTo(this.collection, 'add', this.addOne);
      this.listenTo(this.collection, 'reset', this.addAll);
      this.listenTo(this.collection, 'remove', this.removeOne);
    },
    set_filter_model: function(filter_model) {
      console.debug('GroupListView.set_filter_model()');
      this.options.filter_model = filter_model;
    },
    render: function() {
      console.debug('GroupListView.render()');
      return this;
    },
    query_groups: function() {
      console.log('GroupListView.query_groups()');
      this.options.query_groups(this.collection)
    },
    addOne: function(model) {
      var view = new namespace.GroupView({
        model: model,
        filter_model: this.options.filter_model,
        query_group_repos: this.options.query_group_repos,
        query_repo_issues: this.options.query_repo_issues,
      });
      index = this.collection.indexOf(model);
      view_at_index = this._get_element_of_index(index);
      if (view_at_index.length) {
        console.debug('GroupListView.addOne() group: ' + model.get('name') + ' at index ' + index.toString());
        view_at_index.before(view.render().el);
      } else {
        console.debug('GroupListView.addOne() group: ' + model.get('name') + ' at the end');
        this.$el.append(view.render().el);
      }
    },
    addAll: function() {
      console.debug('GroupListView.addAll()');
      this.$el.html('');
      this.collection.each(this.addOne, this);
    },
    removeOne: function(model, collection, options) {
      console.debug('GroupListView.removeOne() group: ' + model.get('name'));
      this._get_element_of_index(options.index).remove();
    },
    _get_element_of_index: function (index) {
      return this.$('>' + namespace.GroupView.prototype.tagName + ':eq(' + index.toString() + ')');
    }
  });


  /*
   * A filter model has the following attributes:
   * - assignee_is_me
   */
  namespace.FilterModel = Backbone.Model.extend({
    defaults: {
      'assignee_is_me': false,
    },
    match_issue: function(issue_model) {
      if (this.get('assignee_is_me')) {
        console.log('FilterModel.match_issue() assignee_is_me ' + issue_model.get('id'));
        return issue_model.get('assignee_is_me');
      } else {
        console.log('FilterModel.match_issue() all ' + issue_model.get('id'));
        return true;
      }
    }
  });

  namespace.FilterView = Backbone.View.extend({
    tagName: 'div',
    className: 'filter',
    template: _.template($('#filter-template').html()),
    events: {
      'click #assignee_is_me': 'toggle_assignee_is_me',
    },
    initialize: function() {
      console.debug('FilterView.initialize()');
      this.$el.html(this.template());
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'destroy', this.remove);
    },
    render: function() {
      console.debug('FilterView.render()');
      this.$('.filter').html(this.template(this.model.toJSON()));
      this.$('#assignee_is_me').prop('checked', this.model.get('assignee_is_me'));
      return this;
    },
    toggle_assignee_is_me: function() {
      checked = this.$('#assignee_is_me').prop('checked');
      console.debug('FilterView.toggle_assignee_is_me() ' + checked);
      this.model.set({assignee_is_me: checked});
    },
  });


  namespace.IssuesDashboardView = Backbone.View.extend({
    tagName: 'div',
    className: 'issues_dashboard',
    template: _.template($('#issues-dashboard').html()),
    initialize: function() {
      console.debug('IssuesDashboardView.initialize()');
      this.$el.html(this.template());
      this._filter_model = new namespace.FilterModel();
      this._filter_view = new namespace.FilterView({model: this._filter_model});
      this.$('.provider_status').append(this._filter_view.render().el);
      this._providers = [];
    },
    render: function() {
      console.debug('IssuesDashboardView.render()');
      return this;
    },
    get_filter_model: function() {
      console.debug('IssuesDashboardView.get_filter_model()');
      return this._filter_model;
    },
    add_provider: function(provider) {
      console.log('IssuesDashboardView.add_provider() ' + provider.get_name());
      this.$('.provider_status').append(provider.get_status_view().render().el);
      this.$('.provider_login').append(provider.get_login_view().render().el);
      this.$('.provider_dashboard').append(provider.get_dashboard_view().render().el);
      this._providers.push(provider);
    },
  });

})(window.issues_dashboard = window.issues_dashboard || {});
