function Home() {
  return (
    <div className="p-6 mt-8 w-full">
      <h1>Virtual Machines</h1>
      <div className="mt-6 flex justify-between w-full">
        <div>
          <div className="input flex max-w-sm space-x-4 bg-(--color-background) border-r text-[14px]">
            <span className="icon-[tabler--search] my-auto size-5 shrink-0 text-[#63656d]!"></span>
            <input
              type="search"
              className="grow"
              placeholder="Filter VMs..."
              id="kbdInput"
            />
          </div>
        </div>
        <button className="btn btn-primary">Create VM</button>
      </div>
      <div className="w-full overflow-x-auto mt-10">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John Doe</td>
              <td>RUNNING</td>
              <td>March 1, 2024</td>
            </tr>
            <tr>
              <td>Jane Smith</td>
              <td>STOPPED</td>
              <td>March 2, 2024</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Home;
