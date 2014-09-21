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
    initialize: function(options) {
      console.debug('IssueView.initialize() issue #' + this.model.get('number'));
      this._filter_model = options.filter_model;
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change:assignee', this.update_filter_match);
      this.listenTo(this.model, 'change_index', this.change_index);
      this.listenTo(this.model, 'destroy', this.remove);
      this.listenTo(this._filter_model, 'change:assignee', this.update_filter_match);
      this.listenTo(this._filter_model, 'change:age', this.update_filter_match);
      this.update_filter_match();
    },
    render: function() {
      console.debug('IssueView.render() issue #' + this.model.get('number'));
      this.$el.html(this.template(this.model.toJSON()));
      return this;
    },
    update_filter_match: function() {
      console.debug('IssueView.update_filter_match()');
      var old_matches_filter = this.model.get('matches_filter');
      var matches_filter = this._filter_model.match_issue(this.model);
      if (matches_filter) {
        this.$el.show();
      } else {
        this.$el.hide();
      }
      console.debug('IssueView.update_filter_match() ' + matches_filter);
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
    initialize: function(options) {
      console.debug('IssueListView.initialize()');
      this._filter_model = options.filter_model;
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
        filter_model: this._filter_model,
      });
      var index = this.collection.indexOf(model);
      var view_at_index = this._get_element_of_index(index);
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
      this.collection.sort();
    },
    removeOne: function(model, collection, options) {
      console.debug('IssueListView.removeOne() issue #' + model.get('number'));
      this._get_element_of_index(options.index).remove();
    },
    _get_element_of_index: function (index) {
      // in order for this to work the list of issues added with collection.set(issues)
      // must in the correct order, meaning newest to oldest
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
   * - is_starred
   *   matches_filter (populated by the RepositoryView)
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
    initialize: function(options) {
      console.debug('RepositoryView.initialize() full_name: ' + this.model.get('full_name'));
      this._filter_model = options.filter_model;
      this._query_repo_issues = options.query_repo_issues;
      this.$el.html('<div class="repo_header"></div>');
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change:is_starred', this.update_filter_match);
      this.listenTo(this.model, 'destroy', this.remove);
      this.listenTo(this.model, 'change:open_issue_count', this.open_issue_count_changed);
      this.listenTo(this._filter_model, 'change:starred', this.update_filter_match);
      this.issues_queried = false;
      this.issuelist_folded = true;

      this.issue_collection = new namespace.IssueCollection();
      this.listenTo(this.issue_collection, 'add', this.issue_collection_changed);
      this.listenTo(this.issue_collection, 'remove', this.issue_collection_changed);
      this.listenTo(this.issue_collection, 'reset', this.issue_collection_changed);
      this.listenTo(this.issue_collection, 'change:matches_filter', this.change_matches_filter);
      var view = new namespace.IssueListView({
        collection: this.issue_collection,
        filter_model: this._filter_model,
      });
      this.$el.append(view.render().el);
      this.update_filter_match();
    },
    render: function() {
      console.debug('RepositoryView.render() full_name: ' + this.model.get('full_name'));
      // can't use a default value in order to not overwrite values
      // when models are updated with new models from the provider
      var missing = !this.model.has('matched_issue_count');
      if (missing) {
        this.model.set({matched_issue_count: null}, {silent: true});
      }
      this.$('.repo_header').html(this.template(this.model.toJSON()));
      if (missing) {
        this.model.unset('matched_issue_count', {silent: true});
      }
      this.$('.repo_header .loader').hide();
      if (this.issuelist_folded) {
        this.$('.glyphicon-folder-open').hide();
        this.$('.issuelist').hide();
      } else {
        this.$('.glyphicon-folder-close').hide();
        this.$('.issuelist').show();
      }
      return this;
    },
    update_filter_match: function() {
      console.debug('RepositoryView.update_filter_match()');
      var old_matches_filter = this.model.get('matches_filter');
      var matches_filter = this._filter_model.match_repo(this.model);
      if (matches_filter) {
        this.$el.show();
      } else {
        this.$el.hide();
      }
      console.debug('RepositoryView.update_filter_match() ' + matches_filter);
      this.model.set({matches_filter: matches_filter});
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
      this._query_repo_issues(this.model, this.issue_collection, $.proxy(this.query_issues_completed, this));
    },
    query_issues_completed: function() {
      this.$('.repo_header .query_issues').css('display', '');
      this.$('.repo_header .loader').hide();
      if (!this.issues_queried) {
        this.show_issues();
        this.issues_queried = true;
        if (!this.issue_collection.length) {
          // manually trigger model update when no issues are found
          this.issue_collection_changed();
        }
      }
    },
    show_issues: function() {
      console.debug('RepositoryView.show_issues() full_name: ' + this.model.get('full_name'));
      this.$('.glyphicon-folder-close').hide();
      this.$('.glyphicon-folder-open').show();
      if (this.issue_collection.length > 0) {
        this.$('.issuelist').show();
        var height = this.$('.issuelist').css('height', 'auto').css('height');
        this.$('.issuelist').css('height', 0);
        var issuelist = this.$('.issuelist');
        this.$('.issuelist').animate({'height': height + 'px'}, {speed: 200, queue: false, always: function(){
          issuelist.css('height', 'auto');
        }});
      }
      this.issuelist_folded = false;
    },
    hide_issues: function() {
      console.debug('RepositoryView.hide_issues() full_name: ' + this.model.get('full_name'));
      this.$('.glyphicon-folder-close').show();
      this.$('.glyphicon-folder-open').hide();
      var issuelist = this.$('.issuelist');
      this.$('.issuelist').animate({'height': '0px'}, {speed: 200, queue: false, always: function(){
        issuelist.hide();
      }});
      this.issuelist_folded = true;
    },
    open_issue_count_changed: function() {
      if (this.issues_queried && this.model.get('open_issue_count') != this.issue_collection.length) {
        console.debug('RepositoryView.open_issue_count_changed() issue collection length and open_issue_count out of sync: ' + this.issue_collection.length + ' != ' + this.model.get('open_issue_count') + ', query issues');
        this.query_issues();
      } else {
        this.update_matched_issue_count();
      }
    },
    issue_collection_changed: function() {
      console.debug('RepositoryView.issue_collection_changed() full_name: ' + this.model.get('full_name'));
      this.model.set('open_issue_count', this.issue_collection.length);
      this.update_matched_issue_count();
    },
    update_matched_issue_count: function() {
      console.debug('RepositoryView.update_matched_issue_count() full_name: ' + this.model.get('full_name'));
      if (this.issue_collection.length || this.issues_queried) {
        var matched_issue_count = 0;
        var filter_model = this._filter_model;
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
      console.debug('RepositoryView.change_matches_filter() full_name: ' + this.model.get('full_name') + ' issue #' + issue_model.get('number'));
      var offset = 0;
      if (issue_model.get('matches_filter')) {
        console.debug('RepositoryView.change_matches_filter() full_name: ' + this.model.get('full_name') + ' issue #' + issue_model.get('number') + ' increment');
        offset = 1;
      } else if (!issue_model.get('matches_filter') && issue_model.previous('matches_filter')) {
        console.debug('RepositoryView.change_matches_filter() full_name: ' + this.model.get('full_name') + ' issue #' + issue_model.get('number') + ' decrement');
        offset = -1;
      }
      if (offset != 0) {
        this.model.set({matched_issue_count: this.model.get('matched_issue_count') + offset});
      }
    },
  });

  namespace.RepositoryListView = Backbone.View.extend({
    tagName: 'div',
    className: 'repolist',
    initialize: function(options) {
      console.debug('RepositoryListView.initialize()');
      this._filter_model = options.filter_model;
      this._query_repo_issues = options.query_repo_issues;
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
        filter_model: this._filter_model,
        query_repo_issues: this._query_repo_issues,
      });
      var index = this.collection.indexOf(model);
      var view_at_index = this._get_element_of_index(index);
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
   * - starred_repos
   * - open_issue_count (populated by the GroupView, aggregated from the collection of RepositoryModels)
   * - matched_issue_count (populated by the GroupView, aggregated from the collection of RepositoryModels)
   *   matches_filter (populated by the GroupView)
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
    initialize: function(options) {
      console.debug('GroupView.initialize() group: ' + this.model.get('name'));
      this._filter_model = options.filter_model;
      this._query_group_repos = options.query_group_repos;
      this._query_repo_issues = options.query_repo_issues;
      this.$el.html('<div class="group_header"></div>');
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change:starred_repos', this.update_filter_match);
      this.listenTo(this.model, 'change:starred_repos', this.update_starred_repos);
      this.listenTo(this.model, 'destroy', this.remove);
      this.listenTo(this._filter_model, 'change:starred', this.update_filter_match);
      this.repolist_state = null;

      this.repository_collection = new namespace.RepositoryCollection();
      this.listenTo(this.repository_collection, 'add', this.add_repo);
      this.listenTo(this.repository_collection, 'remove', this.remove_repo);
      this.listenTo(this.repository_collection, 'reset', this.reset_repos);
      this.listenTo(this.repository_collection, 'change:matched_issue_count', this.update_matched_issue_count);
      var view = new namespace.RepositoryListView({
        collection: this.repository_collection,
        filter_model: this._filter_model,
        query_repo_issues: this._query_repo_issues,
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
    update_filter_match: function() {
      console.debug('GroupView.update_filter_match()');
      var old_matches_filter = this.model.get('matches_filter');
      var matches_filter = this._filter_model.match_group(this.model);
      if (matches_filter) {
        this.$el.show();
      } else {
        this.$el.hide();
      }
      console.debug('GroupView.update_filter_match() ' + matches_filter);
      this.model.set({matches_filter: matches_filter});
      this.update_open_issue_count();
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
      this._query_group_repos(this.model, this.repository_collection, $.proxy(this.query_repos_completed, this));
    },
    query_repos_completed: function() {
      this.$('.group_header .query_repos').css('display', '');
      this.$('.group_header .loader').hide();
    },
    show_repos: function() {
      console.debug('GroupView.show_repos() group: ' + this.model.get('name'));
      if (this.repository_collection.length > 0) {
        this.$('.repolist').show();
        var height = this.$('.repolist').css('height', 'auto').css('height');
        this.$('.repolist').css('height', 0);
        var repolist = this.$('.repolist');
        this.$('.repolist').animate({'height': height + 'px', 'margin-top': '5px'}, {speed: 200, queue: false, always: function(){
          repolist.css('height', 'auto');
        }});
        this.repolist_state = true;
      }
    },
    hide_repos: function() {
      console.debug('GroupView.hide_repos() group: ' + this.model.get('name'));
      var repolist = this.$('.repolist');
      this.$('.repolist').animate({'height': '0px', 'margin-top': '0px'}, {speed: 200, queue: false, always: function(){
        repolist.hide();
      }});
      this.repolist_state = false;
    },
    add_repo: function(repo_model) {
      console.debug('GroupView.add_repo() group: ' + this.model.get('name') + ' repo ' + repo_model.get('full_name'));
      this.show_repos();

      if (this._filter_model.match_repo(repo_model)) {
        var count = repo_model.get('open_issue_count');
        this.model.set({open_issue_count: this.model.get('open_issue_count') + count});
      }
    },
    remove_repo: function(repo_model) {
      console.debug('GroupView.remove_repo() group: ' + this.model.get('name') + ' repo ' + repo_model.get('full_name'));
      if (this.repository_collection.length == 0) {
        this.hide_repos();
      }

      if (this._filter_model.match_repo(repo_model)) {
        var count = repo_model.get('open_issue_count');
        this.model.set({open_issue_count: this.model.get('open_issue_count') - count});
      }
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
      var open_issue_count = 0;
      var filter_model = this._filter_model;
      this.repository_collection.each(function(repo_model, index) {
        if (filter_model.match_repo(repo_model)) {
          open_issue_count += repo_model.get('open_issue_count');
        }
      });
      this.model.set({open_issue_count: open_issue_count});
      this.update_matched_issue_count();
    },
    update_matched_issue_count: function(repo_model) {
      console.debug('GroupView.update_matched_issue_count() group: ' + this.model.get('name'));
      var model_count = this.model.get('matched_issue_count');
      var repo_model_previous_count = null;
      if (repo_model) {
        repo_model.previous('matched_issue_count');
      }
      // can't use previous count since for multiple adds the previous value is the same value which would result in increasing offsets
      // therefore not using the offset at all but recompute the sum every time
      if (false && model_count != null && repo_model_previous_count != null && typeof repo_model_previous_count != 'undefined') {
        // update group model only by offset of repo model
        if (this._filter_model.match_repo(repo_model)) {
          var offset = repo_model.get('matched_issue_count') - repo_model_previous_count;
          console.debug('GroupView.update_matched_issue_count() group: ' + this.model.get('name') + ' offset ' + offset);
          this.model.set({matched_issue_count: model_count + offset});
        }
      } else {
        // calculate sum of all repo models
        var matched_issue_count = 0;
        var filter_model = this._filter_model;
        this.repository_collection.each(function(repo_model, index) {
          if (filter_model.match_repo(repo_model)) {
            var count = repo_model.get('matched_issue_count');
            if (count != null) {
              //console.debug('GroupView.update_matched_issue_count() repo ' + repo_model.get('full_name') + ' count ' + count);
              matched_issue_count += count;
            } else {
              //console.debug('GroupView.update_matched_issue_count() repo ' + repo_model.get('full_name') + ' "null" ' + repo_model.get('open_issue_count'));
              matched_issue_count += repo_model.get('open_issue_count');
            }
          }
        });
        //console.debug('GroupView.update_matched_issue_count() group: ' + this.model.get('name') + ' all ' + matched_issue_count);
        this.model.set({matched_issue_count: matched_issue_count});
      }
    },
    update_starred_repos: function() {
      console.debug('GroupView.update_starred_repos() group: ' + this.model.get('name'));
      var starred_repos = this.model.get('starred_repos');
      this.repository_collection.each(function(repo_model, index) {
        is_starred = starred_repos.indexOf(repo_model.get('name')) != -1;
        repo_model.set({is_starred: is_starred});
      });
    },
  });

  namespace.GroupListView = Backbone.View.extend({
    tagName: 'div',
    className: 'grouplist',
    initialize: function(options) {
      console.debug('GroupListView.initialize()');
      this._filter_model = null;
      this._query_groups = options.query_groups;
      this._query_group_repos = options.query_group_repos;
      this._query_repo_issues = options.query_repo_issues;
      this.listenTo(this.collection, 'add', this.addOne);
      this.listenTo(this.collection, 'reset', this.addAll);
      this.listenTo(this.collection, 'remove', this.removeOne);
    },
    set_filter_model: function(filter_model) {
      console.debug('GroupListView.set_filter_model()');
      this._filter_model = filter_model;
    },
    render: function() {
      console.debug('GroupListView.render()');
      return this;
    },
    query_groups: function() {
      console.log('GroupListView.query_groups()');
      this._query_groups(this.collection);
    },
    addOne: function(model) {
      var view = new namespace.GroupView({
        model: model,
        filter_model: this._filter_model,
        query_group_repos: this._query_group_repos,
        query_repo_issues: this._query_repo_issues,
      });
      var index = this.collection.indexOf(model);
      var view_at_index = this._get_element_of_index(index);
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
   * - starred
   * - age (in milliseconds)
   */
  namespace.FilterModel = Backbone.Model.extend({
    defaults: {
      'assignee': 'any',
      'starred': false,
      'age': 0,
    },
    match_group: function(group_model) {
      var starred = this.get('starred');
      if (!starred) {
        return true;
      }
      console.log('FilterModel.match_group() starred ' + group_model.get('name'));
      return group_model.get('starred_repos').length > 0;
    },
    match_repo: function(repo_model) {
      var starred = this.get('starred');
      if (!starred) {
        return true;
      }
      console.log('FilterModel.match_repo() starred ' + repo_model.get('name'));
      return repo_model.get('is_starred');
    },
    match_issue: function(issue_model) {
      var age = this.get('age');
      if (age != 0) {
        if (Date.now() - age > issue_model.get('updated_at')) {
          console.log('FilterModel.match_issue() filter by age ' + issue_model.get('number'));
          return false;
        }
      }
      var assignee = this.get('assignee');
      if (assignee == 'any') {
        return true;
      } else if (assignee == 'is_me') {
        console.log('FilterModel.match_issue() assignee is me ' + issue_model.get('number'));
        return issue_model.get('assignee_is_me');
      } else if (assignee == 'is_other') {
        console.log('FilterModel.match_issue() assignee is other ' + issue_model.get('number'));
        return issue_model.get('assignee') != null && !issue_model.get('assignee_is_me');
      } else if (assignee == 'is_unset') {
        console.log('FilterModel.match_issue() assignee is unset ' + issue_model.get('number'));
        return issue_model.get('assignee') == null;
      }
      console.warn('FilterModel.match_issue() unknown filter assignee value: ' + assignee);
      return true;
    }
  });

  namespace.FilterView = Backbone.View.extend({
    tagName: 'div',
    className: 'filter',
    template: _.template($('#filter-template').html()),
    events: {
      'change input': 'change_filter',
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
      this.$('#filter_assignee_' + this.model.get('assignee')).prop('checked', true);
      return this;
    },
    change_filter: function(event) {
      var name  = event.currentTarget.name;
      if (name == 'filter_assignee') {
        var value = event.currentTarget.value;
        console.debug('FilterView.change_filter() assignee: ' + value);
        this.model.set({assignee: value});
      } else if (name == 'filter_starred') {
        var checked = event.currentTarget.checked;
        console.debug('FilterView.change_filter() starred: ' + checked);
        this.model.set({starred: checked});
      } else if (name == 'filter_age_days') {
        var value = event.currentTarget.value;
        console.debug('FilterView.change_filter() age days: ' + value);
        this.model.set({age: value * 24 * 60 * 60 * 1000});
      } else {
        console.warn('FilterView.change_filter() unknown filter name: ' + name);
      }
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
