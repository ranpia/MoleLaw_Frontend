pm.test('CSRF JSON contract and noncacheable response', () => {
  pm.response.to.have.status(200);
  const data = pm.response.json();
  pm.expect(data.token).to.be.a('string').and.not.empty;
  pm.expect(data.headerName).to.eql('X-XSRF-TOKEN');
  pm.expect(pm.response.headers.get('Cache-Control')).to.include('no-store');
});
