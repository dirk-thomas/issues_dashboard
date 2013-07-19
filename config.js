(function($) {

  debug = false;
  if (!debug) {
    console.debug = function() {}
  }

  dashboard = new issues_dashboard.IssuesDashboardView();
  $('#main').append(dashboard.render().el);

  github = new github_provider.GitHubProvider();
  dashboard.add_provider(github);

  // auto-login
  /*options = {
    auth: 'oauth',
    token: '',
  }*/
  // or
  /*options = {
    auth: 'basic',
    username: '',
    password: '',
  }*/
  //github.login(options);

})(jQuery);
