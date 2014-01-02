(function($) {

  debug = false;
  if (!debug) {
    console.debug = function() {};
  }

  dashboard = new issues_dashboard.IssuesDashboardView();
  $('#main').append(dashboard.render().el);

  github = new github_provider.GitHubProvider();
  github.get_dashboard_view().set_filter_model(dashboard.get_filter_model());
  dashboard.add_provider(github);

  /*test = new test_provider.TestProvider();
  test.get_dashboard_view().set_filter_model(dashboard.get_filter_model());
  dashboard.add_provider(test);*/

  // auto-login
  /*options = {
    auth: 'oauth',
    token: '',
  };*/
  // or
  /*options = {
    auth: 'basic',
    username: '',
    password: '',
  }*/
  //github.login(options);

  //test.login();

})(jQuery);
