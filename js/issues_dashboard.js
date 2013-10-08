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
   * - pull_request
   * - updated_at
   * - labels[]
   *   - label
   *   - color
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
      this.listenTo(this.model, 'change_index', this.change_index);
      this.listenTo(this.model, 'destroy', this.remove);
    },
    render: function() {
      console.debug('IssueView.render() issue #' + this.model.get('number'));
      this.$el.html(this.template(this.model.toJSON()));
      return this;
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
      var view = new namespace.IssueView({model: model});
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
   * - has_issues
   * - open_issues
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
      this.issuelist_state = null;

      this.issue_collection = new namespace.IssueCollection();
      this.listenTo(this.issue_collection, 'add', this.update_issue_count);
      this.listenTo(this.issue_collection, 'remove', this.update_issue_count);
      this.listenTo(this.issue_collection, 'reset', this.update_issue_count);
      var view = new namespace.IssueListView({collection: this.issue_collection});
      this.$el.append(view.render().el);
    },
    render: function() {
      console.debug('RepositoryView.render() full_name: ' + this.model.get('full_name'));
      this.$('.repo_header').html(this.template(this.model.toJSON()));
      this.$('.repo_header .loader').hide();
      if (this.issue_collection.length == 0) {
        this.$('.icon-folder-open').hide();
        this.$('.issuelist').hide();
      }
      return this;
    },
    skip_event: function(event) {
      event.stopPropagation();
    },
    toggle_issuelist: function() {
      console.log('RepositoryView.toggle_issuelist() full_name: ' + this.model.get('full_name'));
      if (this.issuelist_state === null) {
        this.query_issues();
      } else if (this.issuelist_state) {
        this.hide_issues();
      } else {
        this.show_issues();
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
    },
    show_issues: function() {
      console.debug('RepositoryView.show_issues() full_name: ' + this.model.get('full_name'));
      if (this.issue_collection.length > 0) {
        this.$('.icon-folder-close').hide();
        this.$('.icon-folder-open').show();
        this.$('.issuelist').show();
        height = this.$('.issuelist').css('height', 'auto').height();
        this.$('.issuelist').height(0);
        issuelist = this.$('.issuelist')
        this.$('.issuelist').animate({'height': height + 'px'}, {speed: 200, queue: false, always: function(){
          issuelist.height('auto');
        }});
        this.issuelist_state = true;
      }
    },
    hide_issues: function() {
      console.debug('RepositoryView.hide_issues() full_name: ' + this.model.get('full_name'));
      this.$('.icon-folder-close').show();
      this.$('.icon-folder-open').hide();
      issuelist = this.$('.issuelist');
      this.$('.issuelist').animate({'height': '0px'}, {speed: 200, queue: false, always: function(){
        issuelist.hide();
      }});
      this.issuelist_state = false;
    },
    update_issue_count: function() {
      console.debug('RepositoryView.update_issue_count() full_name: ' + this.model.get('full_name'));
      this.model.set({open_issues: this.issue_collection.length});
      if (this.issue_collection.length > 0) {
        this.show_issues();
      } else {
        this.hide_issues();
      }
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
   * - open_issues (aggregated from all repositories)
   */
  namespace.GroupModel = Backbone.Model.extend({
    defaults: {
      'open_issues': 0,
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
      this.listenTo(this.repository_collection, 'add', this.add_repo_model);
      this.listenTo(this.repository_collection, 'remove', this.update_repository_count);
      this.listenTo(this.repository_collection, 'reset', this.update_repository_count);
      var view = new namespace.RepositoryListView({
        collection: this.repository_collection,
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
    add_repo_model: function (repo_model) {
      console.debug('GroupView.add_repo_model() group: ' + this.model.get('name'));
      this.listenTo(repo_model, 'change:open_issues', this.update_issue_count);
      this.update_repository_count();
    },
    update_repository_count: function() {
      console.debug('GroupView.update_repository_count() group: ' + this.model.get('name'));
      if (this.repository_collection.length > 0) {
        this.show_repos();
      } else {
        this.hide_repos();
      }
      this.update_issue_count();
    },
    update_issue_count: function() {
      console.debug('GroupView.update_issue_count() group: ' + this.model.get('name'));
      open_issues = 0;
      this.repository_collection.each(function(repo_model, index) {
        open_issues += repo_model.get('open_issues')
      });
      this.model.set({open_issues: open_issues});
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


  namespace.IssuesDashboardView = Backbone.View.extend({
    tagName: 'div',
    class: 'issues_dashboard',
    template: _.template($('#issues-dashboard').html()),
    initialize: function() {
      console.debug('IssuesDashboardView.initialize()');
      this.$el.html(this.template());
      this._providers = [];
    },
    render: function() {
      console.debug('IssuesDashboardView.render()');
      return this;
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
