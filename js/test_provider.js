/**
 * Provider generating test data
 * into the issues dashboard.
 * 
 * Copyright (c) 2013, Dirk Thomas
 * Distributed under the BSD 2-Clause license
 * https://github.com/dirk-thomas/issues_dashboard/
 **/

(function(namespace, issues_dashboard_namespace) {

  namespace.TestModel = Backbone.Model.extend({
    initialize: function() {
      console.debug('TestModel.initialize()');
      this.logged_in = false;
    },
    login: function (options) {
      console.debug('TestModel.login()');
      this.logged_in = true;
      this.trigger('logged_in');
    },
    logout: function() {
      console.log('TestModel.logout()');
      this.logged_in = false;
      this.trigger('logged_out');
    },
  });


  namespace.LoginView = Backbone.View.extend({
    tagName: 'div',
    className: 'login test_login',
    events: {
      'click .login_button': 'login',
      'click .hide_button': 'hide',
    },
    initialize: function(test_model) {
      console.debug('LoginView.initialize()');
      this.test_model = test_model;
      this.listenTo(this.test_model, 'logged_in', this.hide);
    },
    render: function() {
      console.debug('LoginView.render()');
      if (!this.test_model.logged_in) {
        console.debug('LoginView.render() not logged in');
        var tmpl = _.template($("#test-login-form").html());
        this.$el.html(tmpl());
      } else {
        this.hide();
      }
      return this;
    },
    show: function() {
      this.render();
      this.$el.show();
    },
    hide: function() {
      this.$el.hide();
      this.$el.html('');
    },
    login: function() {
      console.debug('LoginView.login()');
      this.test_model.login();
    },
  });


  namespace.StatusView = Backbone.View.extend({
    tagName: 'div',
    className: 'status',
    events: {
      'click .add_repo_button': 'increment_repos',
      'click .remove_repo_button': 'decrement_repos',
      'click .add_issue_button': 'increment_issues',
      'click .remove_issue_button': 'decrement_issues',
      'click .login_button': 'login',
      'click .logout_button': 'logout',
    },
    initialize: function(test_model, login_view) {
      console.debug('StatusView.initialize()');
      this.test_model = test_model;
      this.login_view = login_view;
      this.listenTo(this.test_model, 'change', this.render);
      this.listenTo(this.test_model, 'logged_in', this.render);
      this.listenTo(this.test_model, 'logged_out', this.render);
    },
    render: function() {
      console.debug('StatusView.render()');
      if (!this.test_model.logged_in) {
        console.debug('StatusView.render() not logged in');
        var tmpl = _.template($("#test-status-not-logged-in").html());
        this.$el.html(tmpl());
      } else {
        console.debug('StatusView.render() logged in');
        var tmpl = _.template($("#test-status-logged-in").html());
        groups = this.test_model.get('groups');
        repos = this.test_model.get('repos');
        issues = this.test_model.get('issues');
        this.$el.html(tmpl({groups: groups, repos: repos, issues: issues}));
      }
      return this;
    },
    increment_repos: function() {
      console.debug('StatusView.increment_repos()');
      repos = this.test_model.get('repos');
      this.test_model.set({repos: repos + 1})
    },
    decrement_repos: function() {
      console.debug('StatusView.decrement_repos()');
      repos = this.test_model.get('repos');
      if (repos > 0) {
        this.test_model.set({repos: repos - 1})
      }
    },
    increment_issues: function() {
      console.debug('StatusView.increment_issues()');
      issues = this.test_model.get('issues');
      this.test_model.set({issues: issues + 1})
    },
    decrement_issues: function() {
      console.debug('StatusView.decrement_issues()');
      issues = this.test_model.get('issues');
      if (issues > 0) {
        this.test_model.set({issues: issues - 1})
      }
    },
    login: function() {
      this.login_view.show();
    },
    logout: function() {
      this.test_model.logout();
    },
  });


  namespace.DashboardView = Backbone.View.extend({
    tagName: 'div',
    className: 'test',
    initialize: function(test_model) {
      console.debug('DashboardView.initialize()');
      this.test_model = test_model;
      self = this;

      function _query_groups(group_collection) {
        console.debug('_query_groups()');
        models = [];
        for (i = 1; i <= self.test_model.get('groups'); i++) {
          console.debug('query_groups() add group');
          data = {
            id: 'G' + i,
            name: 'G' + i,
            avatar_url: null,
          }
          models.push(new issues_dashboard_namespace.GroupModel(data));
        }
        group_collection.set(models);
      }

      function _query_group_repos(model, repository_collection, complete_callback) {
        console.debug('_query_group_repos()');
        models = [];
        for (i = 1; i <= self.test_model.get('repos'); i++) {
          console.debug('query_repos() add repo');
          data = {
            id: 'R' + i,
            name: 'R' + i,
            full_name: 'R' + i,
            repo_url: '',
            open_issues_url: '',
            open_issue_count: self.test_model.get('issues'),
          }
          models.push(new issues_dashboard_namespace.RepositoryModel(data));
        }
        repository_collection.set(models);
        if (complete_callback) {
          complete_callback();
        }
      }

      function _query_repo_issues(model, issue_collection, complete_callback) {
        console.debug('_query_repo_issues()');
        models = [];
        for (i = self.test_model.get('issues'); i > 0; i--) {
          console.debug('query_repos() add issue');
          data = {
            id: 'I' + i,
            number: i,
            title: 'I' + i,
            issue_url: '',
            creator: 'creator',
            assignee: i % 3 == 0 ? 'assigne_is_me' : (i % 3 == 1 ? 'assignee' : null),
            assignee_is_me:  i % 3 == 0,
            pull_request: i % 2 == 0,
            updated_at: i,
            labels: [],
          }
          models.push(new issues_dashboard_namespace.IssueModel(data));
        }
        issue_collection.set(models);
        if (complete_callback) {
          complete_callback();
        }
      }

      this.group_collection = new issues_dashboard_namespace.GroupCollection();
      this.group_list_view = new issues_dashboard_namespace.GroupListView({
        collection: this.group_collection,
        query_groups: _query_groups,
        query_group_repos: _query_group_repos,
        query_repo_issues: _query_repo_issues,
      });
      this.$el.append(this.group_list_view.render().el);

      this.listenTo(this.test_model, 'logged_in', this.logged_in);
      this.listenTo(this.test_model, 'logged_out', this.logged_out);
    },
    set_filter_model: function(filter_model) {
      this.group_list_view.set_filter_model(filter_model);
    },
    render: function() {
      console.debug('DashboardView.render()');
      return this;
    },
    logged_in: function() {
      console.debug('DashboardView.logged_in()');
      this.group_list_view.query_groups();
    },
    logged_out: function() {
      console.debug('DashboardView.logged_out()');
      this.group_collection.reset();
    },
  });


  namespace.TestProvider = function() {
    this.test_model = new namespace.TestModel({groups: 1, repos: 1, issues: 1});
    this.login_view = new namespace.LoginView(this.test_model);
    this.status_view = new namespace.StatusView(this.test_model, this.login_view);
    this.dashboard_view = new namespace.DashboardView(this.test_model);

    this.login = function(options) {
      console.debug('TestProvider.login()');
      this.test_model.login();
    };

    this.get_name = function() {
      return 'Test';
    };

    this.get_status_view = function() {
      return this.status_view
    };

    this.get_login_view = function() {
      return this.login_view;
    };

    this.get_dashboard_view = function() {
      return this.dashboard_view;
    };
  };

})(window.test_provider = window.test_provider || {}, window.issues_dashboard);
